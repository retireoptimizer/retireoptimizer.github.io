"""Integration-style unit tests for engine/projection.py."""
import pytest

from fireopt.engine.projection import run_projection
from fireopt.schemas.conversion import ManualConversionEntry, RothConversionConfig
from fireopt.schemas.market import MarketAssumptions
from fireopt.schemas.plan_input import PlanHorizon
from fireopt.schemas.streams import ExpenseStream, StreamSchedule
from tests.fixtures.factories import make_plan


def _flat_plan(
    *,
    horizon_years: int = 10,
    taxable: float = 200_000,
    pretax: float = 500_000,
    roth: float = 100_000,
    expected_return: float = 0.0,
    taxable_drag: float = 0.0,
    inflation_rate: float = 0.0,
):
    """Plan with zero growth and inflation for deterministic balance checks."""
    plan = make_plan(taxable=taxable, pretax=pretax, roth=roth)
    plan.horizon = PlanHorizon(start_year=2025, horizon_years=horizon_years)
    plan.market = MarketAssumptions(
        expected_return=expected_return,
        volatility=0.0,
        taxable_drag=taxable_drag,
    )
    plan.tax.cpi_inflation_rate = inflation_rate
    plan.tax.standard_deduction = 30_000
    return plan


# ---------------------------------------------------------------------------
# Row count and year sequence
# ---------------------------------------------------------------------------


def test_projection_row_count():
    plan = _flat_plan(horizon_years=10)
    result = run_projection(plan)
    assert len(result.rows) == 10


def test_projection_year_sequence():
    plan = _flat_plan(horizon_years=5)
    result = run_projection(plan)
    assert [r.year for r in result.rows] == [2025, 2026, 2027, 2028, 2029]


# ---------------------------------------------------------------------------
# Age and alive fields
# ---------------------------------------------------------------------------


def test_projection_age_fields():
    plan = _flat_plan(horizon_years=1)
    # Alice born 1960, Bob born 1962; year 2025
    row = run_projection(plan).rows[0]
    assert row.age_a == 65
    assert row.age_b == 63
    assert row.both_alive is True


def test_projection_person_dies():
    plan = _flat_plan(horizon_years=40)
    plan.person_a.life_expectancy_age = 70  # Alice dies at 70 (year 2030)
    rows = run_projection(plan).rows
    # In year 2030 Alice turns 70, still alive; year 2031 she's 71 → dead
    alive_2030 = next(r.both_alive for r in rows if r.year == 2030)
    alive_2031 = next(r.both_alive for r in rows if r.year == 2031)
    assert alive_2030 is True
    assert alive_2031 is False


# ---------------------------------------------------------------------------
# Balance growth (no income, no expenses)
# ---------------------------------------------------------------------------


def test_projection_zero_growth_no_income_no_expenses():
    """With 0% return and no expenses, balances should stay flat after SS/taxes
    (no SS PIA set in this plan variant)."""
    plan = _flat_plan(taxable=100_000, pretax=0, roth=0, expected_return=0.0)
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    # No income/expenses streams; tax will be zero; balances stay flat
    row = run_projection(plan).rows[0]
    assert row.end_balance_taxable == pytest.approx(100_000, rel=1e-6)


def test_projection_compound_growth_pretax():
    """Pretax grows at expected_return each year."""
    plan = _flat_plan(pretax=100_000, taxable=0, roth=0, expected_return=0.06)
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    rows = run_projection(plan).rows
    # After 3 years: 100_000 * 1.06^3 (no RMDs since ages 65/63)
    assert rows[2].end_balance_pretax == pytest.approx(100_000 * 1.06**3, rel=1e-6)


def test_projection_taxable_drag_reduces_growth():
    plan = _flat_plan(taxable=100_000, pretax=0, roth=0, expected_return=0.06, taxable_drag=0.01)
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    rows = run_projection(plan).rows
    # Net return on taxable = 0.06 - 0.01 = 0.05
    assert rows[0].end_balance_taxable == pytest.approx(100_000 * 1.05, rel=1e-3)


# ---------------------------------------------------------------------------
# LTCG
# ---------------------------------------------------------------------------


def test_projection_ltcg_income():
    plan = _flat_plan(taxable=200_000, pretax=0, roth=0, taxable_drag=0.005)
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    row = run_projection(plan).rows[0]
    assert row.ltcg_income == pytest.approx(200_000 * 0.005, rel=1e-6)


# ---------------------------------------------------------------------------
# SS starts at claim year
# ---------------------------------------------------------------------------


def test_projection_ss_zero_before_claim():
    plan = _flat_plan(horizon_years=5)
    plan.person_a.ss_pia_monthly = 2000
    plan.person_a.ss_claim_age = 67  # born 1960 → claims 2027
    result = run_projection(plan)
    row_2025 = result.rows[0]
    # 2025: age 65, not yet 67 → no SS
    assert row_2025.ss_a_taxable == 0.0


def test_projection_ss_starts_at_claim_year():
    plan = _flat_plan(horizon_years=5, taxable=0, pretax=0, roth=0)
    plan.person_a.ss_pia_monthly = 2000
    plan.person_a.ss_claim_age = 67  # born 1960 → year 2027
    plan.person_b.ss_pia_monthly = 0
    result = run_projection(plan)
    row_2027 = next(r for r in result.rows if r.year == 2027)
    # Provisional income = 0.5 * 24000 = 12000 < 32000 MFJ low threshold → 0 taxable
    assert row_2027.ss_a_taxable == 0.0  # under threshold


# ---------------------------------------------------------------------------
# RMDs
# ---------------------------------------------------------------------------


def test_projection_no_rmd_before_73():
    plan = _flat_plan(horizon_years=1, pretax=500_000)
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    # Alice is 65, Bob is 63 in 2025 — no RMDs
    row = run_projection(plan).rows[0]
    assert row.rmd_a == 0.0
    assert row.rmd_b == 0.0


def test_projection_rmd_starts_at_73():
    plan = _flat_plan(horizon_years=20, pretax=1_000_000)
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    # Alice born 1960, turns 73 in 2033
    rows = {r.year: r for r in run_projection(plan).rows}
    assert rows[2032].rmd_a == pytest.approx(0.0)
    assert rows[2033].rmd_a > 0.0  # RMD kicks in


# ---------------------------------------------------------------------------
# Roth conversion
# ---------------------------------------------------------------------------


def test_projection_roth_conversion_manual():
    plan = _flat_plan(pretax=500_000, roth=100_000, taxable=0)
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    plan.conversion = RothConversionConfig(
        mode="manual",
        manual_entries=[ManualConversionEntry(year=2025, amount=50_000)],
    )
    row = run_projection(plan).rows[0]
    assert row.roth_conversion == pytest.approx(50_000)
    # Roth balance grew by conversion amount (then by 0% return since expected_return=0)
    assert row.end_balance_roth == pytest.approx(150_000, rel=1e-5)


def test_projection_conversion_off():
    plan = _flat_plan(pretax=500_000)
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    plan.conversion = RothConversionConfig(mode="off")
    row = run_projection(plan).rows[0]
    assert row.roth_conversion == 0.0


# ---------------------------------------------------------------------------
# Expenses / withdrawals / shortfall
# ---------------------------------------------------------------------------


def _expense_stream(amount: float, start: int = 2025, end: int = 2054) -> ExpenseStream:
    return ExpenseStream(
        id="exp",
        label="Living",
        kind="essential_expense",
        schedule=StreamSchedule(
            start_year=start,
            end_year=end,
            annual_amount_today=amount,
            inflation_indexed=False,
        ),
    )


def test_projection_withdrawal_covers_expenses():
    plan = _flat_plan(taxable=500_000, pretax=0, roth=0)
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    plan.expense_streams.append(_expense_stream(50_000))
    row = run_projection(plan).rows[0]
    # expenses = 50_000, no income, tax ≈ 0, withdrawal from taxable ≈ 50_000
    total_wd = row.withdrawal_taxable + row.withdrawal_pretax + row.withdrawal_roth
    assert total_wd == pytest.approx(50_000, rel=1e-3)


def test_projection_shortfall_sets_failure_year():
    plan = _flat_plan(taxable=10_000, pretax=0, roth=0, horizon_years=5)
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    # Expenses far exceed balance — failure expected in year 1
    plan.expense_streams.append(_expense_stream(100_000))
    result = run_projection(plan)
    assert result.summary.success is False
    assert result.summary.first_failure_year == 2025


def test_projection_no_failure_adequate_assets():
    plan = _flat_plan(taxable=10_000_000, pretax=0, roth=0, horizon_years=5)
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    plan.expense_streams.append(_expense_stream(100_000))
    result = run_projection(plan)
    assert result.summary.success is True
    assert result.summary.first_failure_year is None


# ---------------------------------------------------------------------------
# Summary fields
# ---------------------------------------------------------------------------


def test_projection_summary_final_balance():
    plan = _flat_plan(taxable=100_000, pretax=0, roth=0, expected_return=0.0, horizon_years=2)
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    result = run_projection(plan)
    last = result.rows[-1]
    assert result.summary.final_balance_nominal == pytest.approx(last.end_balance_total)


def test_projection_summary_plan_hash_deterministic():
    plan = _flat_plan()
    h1 = run_projection(plan).plan_hash
    h2 = run_projection(plan).plan_hash
    assert h1 == h2
    assert len(h1) == 16


def test_projection_summary_plan_hash_changes():
    plan1 = _flat_plan(taxable=100_000)
    plan2 = _flat_plan(taxable=200_000)
    assert run_projection(plan1).plan_hash != run_projection(plan2).plan_hash


def test_projection_lifetime_taxes_accumulate():
    plan = _flat_plan(taxable=2_000_000, pretax=0, roth=0, horizon_years=10)
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    # Large expenses force withdrawals which trigger tax
    plan.expense_streams.append(_expense_stream(80_000))
    result = run_projection(plan)
    manual_sum = sum(r.total_tax for r in result.rows)
    assert result.summary.lifetime_taxes_nominal == pytest.approx(manual_sum, rel=1e-9)


# ---------------------------------------------------------------------------
# effective_tax_rate / marginal_tax_rate sanity
# ---------------------------------------------------------------------------


def test_projection_zero_income_zero_effective_rate():
    plan = _flat_plan(taxable=100_000, pretax=0, roth=0)
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    row = run_projection(plan).rows[0]
    assert row.effective_tax_rate == pytest.approx(0.0, abs=1e-6)


def test_projection_marginal_rate_is_valid_bracket():
    valid_rates = {0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37}
    plan = _flat_plan()
    plan.person_a.ss_pia_monthly = 0
    plan.person_b.ss_pia_monthly = 0
    for row in run_projection(plan).rows:
        assert row.marginal_tax_rate in valid_rates
