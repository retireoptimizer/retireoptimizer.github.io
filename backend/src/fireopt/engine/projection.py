import hashlib

from fireopt.engine.constants import (
    FEDERAL_BRACKETS_LTCG_MFJ_2025,
    FEDERAL_BRACKETS_ORDINARY_MFJ_2025,
    STANDARD_DEDUCTION_MFJ_2025,
)
from fireopt.engine.conversion import planned_roth_conversion
from fireopt.engine.rmd import required_min_distribution
from fireopt.engine.ss import social_security_annual, survivor_benefit, taxable_ss_portion
from fireopt.engine.streams import aggregate_streams, stream_amount_in_year
from fireopt.engine.tax import (
    federal_ordinary_tax,
    ltcg_tax,
    medicare_surtax,
    niit,
    state_tax,
)
from fireopt.engine.withdrawal import withdraw_to_cover
from fireopt.schemas.plan_input import BucketBalances, PlanInput
from fireopt.schemas.projection_output import ProjectionResult, ProjectionSummary, YearRow
from fireopt.schemas.tax import TaxBracket


def _get_brackets(plan: PlanInput) -> tuple[list[TaxBracket], list[TaxBracket], float]:
    cfg = plan.tax
    if cfg.use_2025_mfj_default:
        return (
            FEDERAL_BRACKETS_ORDINARY_MFJ_2025,
            FEDERAL_BRACKETS_LTCG_MFJ_2025,
            STANDARD_DEDUCTION_MFJ_2025,
        )
    return cfg.federal_brackets_ordinary, cfg.federal_brackets_ltcg, cfg.standard_deduction


def _marginal_rate(
    taxable_income: float,
    brackets: list[TaxBracket],
    std_deduction: float,
) -> float:
    agi = max(0.0, taxable_income - std_deduction)
    for bracket in brackets:
        upper = bracket.upper if bracket.upper is not None else float("inf")
        if agi <= upper:
            return bracket.rate
    return brackets[-1].rate if brackets else 0.0


def _plan_hash(plan: PlanInput) -> str:
    return hashlib.sha256(plan.model_dump_json().encode()).hexdigest()[:16]


def run_projection(plan: PlanInput) -> ProjectionResult:
    base_year = plan.horizon.start_year
    ord_brackets, ltcg_brackets, std_deduction = _get_brackets(plan)
    mkt = plan.market
    taxable_net_return = mkt.expected_return - mkt.taxable_drag

    bal_taxable = plan.starting_balances.taxable
    bal_pretax = plan.starting_balances.pretax
    bal_roth = plan.starting_balances.roth

    rows: list[YearRow] = []
    lifetime_taxes_nominal = 0.0
    lifetime_taxes_pv = 0.0
    first_failure_year: int | None = None

    for year in range(base_year, base_year + plan.horizon.horizon_years):
        # ── alive status ──────────────────────────────────────────────────
        age_a = year - plan.person_a.birth_date.year
        age_b = year - plan.person_b.birth_date.year
        a_alive = age_a <= plan.person_a.life_expectancy_age
        b_alive = age_b <= plan.person_b.life_expectancy_age
        both_alive = a_alive and b_alive

        # ── cumulative CPI factor ─────────────────────────────────────────
        cpi_factor = (1.0 + plan.tax.cpi_inflation_rate) ** (year - base_year)

        # ── income / expense streams ──────────────────────────────────────
        streams = aggregate_streams(plan, year, cpi_factor, base_year)

        # ── Social Security ───────────────────────────────────────────────
        ss_a_raw = social_security_annual(plan.person_a, year, cpi_factor) if a_alive else 0.0
        ss_b_raw = social_security_annual(plan.person_b, year, cpi_factor) if b_alive else 0.0
        total_ss = survivor_benefit(ss_a_raw, ss_b_raw, a_alive, b_alive)

        provisional_income = streams.taxable_income + 0.5 * total_ss
        total_ss_taxable = taxable_ss_portion(provisional_income, total_ss, plan.filing_status)

        if total_ss > 0:
            ss_a_taxable = total_ss_taxable * (ss_a_raw / total_ss)
            ss_b_taxable = total_ss_taxable * (ss_b_raw / total_ss)
        else:
            ss_a_taxable = 0.0
            ss_b_taxable = 0.0

        # ── RMDs (pretax split 50/50 between persons) ─────────────────────
        pretax_half = bal_pretax / 2.0
        rmd_a = required_min_distribution(pretax_half, age_a) if a_alive else 0.0
        rmd_b = required_min_distribution(pretax_half, age_b) if b_alive else 0.0
        total_rmds = min(rmd_a + rmd_b, bal_pretax)

        # ── LTCG from taxable account drag ────────────────────────────────
        ltcg_income = bal_taxable * mkt.taxable_drag

        # ── Roth conversion ───────────────────────────────────────────────
        ordinary_income_pre_conv = streams.taxable_income + total_ss_taxable + total_rmds
        pretax_for_conversion = max(0.0, bal_pretax - total_rmds)
        conversion = planned_roth_conversion(
            plan.conversion,
            year,
            pretax_for_conversion,
            ordinary_income_pre_conv,
            ord_brackets,
            std_deduction,
        )

        ordinary_taxable_income = ordinary_income_pre_conv + conversion

        # ── federal taxes ─────────────────────────────────────────────────
        fed_tax = federal_ordinary_tax(ordinary_taxable_income, ord_brackets, std_deduction)
        ord_agi = max(0.0, ordinary_taxable_income - std_deduction)
        ltcg_tax_amt = ltcg_tax(ltcg_income, ord_agi, ltcg_brackets)

        # ── NIIT and Medicare surtax ──────────────────────────────────────
        tax_cfg = plan.tax
        niit_amt = niit(
            ordinary_taxable_income + ltcg_income,
            ltcg_income,
            tax_cfg.niit_threshold_mfj,
            tax_cfg.niit_rate,
        )

        wages = 0.0
        for wage_stream in plan.income_streams:
            if wage_stream.kind in ("salary", "self_employment"):
                wages += stream_amount_in_year(wage_stream, year, cpi_factor, base_year)
        med_surtax_amt = medicare_surtax(
            wages, tax_cfg.medicare_surtax_threshold_mfj, tax_cfg.medicare_surtax_rate
        )

        state_tax_amt = state_tax(ordinary_taxable_income, total_ss_taxable, plan)

        total_tax = fed_tax + ltcg_tax_amt + niit_amt + med_surtax_amt + state_tax_amt

        # ── cash need and withdrawals ─────────────────────────────────────
        # Cash available before discretionary withdrawal
        gross_cash = streams.gross_income + total_ss + total_rmds
        net_withdrawal_need = max(0.0, streams.expenses + total_tax - gross_cash)

        adj_balances = BucketBalances(
            taxable=bal_taxable,
            pretax=max(0.0, bal_pretax - total_rmds - conversion),
            roth=max(0.0, bal_roth + conversion),
            taxable_cost_basis=0.0,
        )
        wd = withdraw_to_cover(net_withdrawal_need, plan.withdrawal_policy, adj_balances)

        # ── end-of-year balances (pre-growth) ─────────────────────────────
        total_cash_available = gross_cash + wd.total
        total_cash_needed = streams.expenses + total_tax
        reinvested = max(0.0, total_cash_available - total_cash_needed)

        eoy_taxable = max(0.0, bal_taxable - wd.taxable + reinvested)
        eoy_pretax = max(0.0, bal_pretax - total_rmds - conversion - wd.pretax)
        eoy_roth = max(0.0, bal_roth + conversion - wd.roth)

        # ── apply market growth ───────────────────────────────────────────
        end_bal_taxable = eoy_taxable * (1.0 + taxable_net_return)
        end_bal_pretax = eoy_pretax * (1.0 + mkt.expected_return)
        end_bal_roth = eoy_roth * (1.0 + mkt.expected_return)
        end_bal_total = end_bal_taxable + end_bal_pretax + end_bal_roth

        # ── rates ────────────────────────────────────────────────────────
        total_income = streams.gross_income + total_ss + ltcg_income
        effective_tax_rate = total_tax / max(1.0, total_income)
        marginal_rate = _marginal_rate(ordinary_taxable_income, ord_brackets, std_deduction)

        if wd.shortfall > 0 and first_failure_year is None:
            first_failure_year = year

        discount = (1.0 + plan.tax.cpi_inflation_rate) ** (year - base_year)
        lifetime_taxes_nominal += total_tax
        lifetime_taxes_pv += total_tax / discount

        rows.append(YearRow(
            year=year,
            age_a=age_a,
            age_b=age_b,
            both_alive=both_alive,
            gross_income=streams.gross_income,
            ordinary_taxable_income=ordinary_taxable_income,
            ltcg_income=ltcg_income,
            ss_a_taxable=ss_a_taxable,
            ss_b_taxable=ss_b_taxable,
            rmd_a=rmd_a,
            rmd_b=rmd_b,
            roth_conversion=conversion,
            federal_tax=fed_tax,
            state_tax=state_tax_amt,
            niit=niit_amt,
            medicare_surtax=med_surtax_amt,
            total_tax=total_tax,
            expenses=streams.expenses,
            withdrawal_taxable=wd.taxable,
            withdrawal_pretax=wd.pretax,
            withdrawal_roth=wd.roth,
            end_balance_taxable=end_bal_taxable,
            end_balance_pretax=end_bal_pretax,
            end_balance_roth=end_bal_roth,
            end_balance_total=end_bal_total,
            effective_tax_rate=effective_tax_rate,
            marginal_tax_rate=marginal_rate,
        ))

        bal_taxable = end_bal_taxable
        bal_pretax = end_bal_pretax
        bal_roth = end_bal_roth

    last_row = rows[-1] if rows else None
    final_balance_nominal = last_row.end_balance_total if last_row else 0.0
    final_balance_pv = final_balance_nominal / (
        (1.0 + plan.tax.cpi_inflation_rate) ** plan.horizon.horizon_years
    )

    summary = ProjectionSummary(
        lifetime_taxes_nominal=lifetime_taxes_nominal,
        lifetime_taxes_pv=lifetime_taxes_pv,
        final_balance_nominal=final_balance_nominal,
        final_balance_pv=final_balance_pv,
        success=first_failure_year is None,
        first_failure_year=first_failure_year,
        avg_effective_rate=sum(r.effective_tax_rate for r in rows) / len(rows) if rows else 0.0,
    )

    return ProjectionResult(
        plan_hash=_plan_hash(plan),
        rows=rows,
        summary=summary,
    )
