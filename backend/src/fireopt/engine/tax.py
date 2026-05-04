from fireopt.schemas.plan_input import PlanInput
from fireopt.schemas.tax import TaxBracket


def federal_ordinary_tax(
    taxable_income: float,
    brackets: list[TaxBracket],
    std_deduction: float,
) -> float:
    """Compute federal ordinary income tax using stacked brackets after std deduction."""
    agi = max(0.0, taxable_income - std_deduction)
    tax = 0.0
    prev_upper = 0.0
    for bracket in brackets:
        upper = bracket.upper if bracket.upper is not None else float("inf")
        slice_income = max(0.0, min(agi, upper) - prev_upper)
        tax += slice_income * bracket.rate
        prev_upper = upper
        if agi <= upper:
            break
    return tax


def ltcg_tax(
    ltcg: float,
    ordinary_taxable: float,
    ltcg_brackets: list[TaxBracket],
) -> float:
    """LTCG tax: ordinary income fills brackets first, LTCG stacked on top."""
    if ltcg <= 0:
        return 0.0
    tax = 0.0
    filled = ordinary_taxable  # ordinary income already occupies lower brackets
    prev_upper = 0.0
    for bracket in ltcg_brackets:
        upper = bracket.upper if bracket.upper is not None else float("inf")
        # how much of this bracket is available for LTCG after ordinary income fills it
        bracket_start = max(prev_upper, filled)
        bracket_end = upper
        available = max(0.0, bracket_end - bracket_start)
        slice_income = min(ltcg, available)
        tax += slice_income * bracket.rate
        ltcg -= slice_income
        prev_upper = upper
        if ltcg <= 0:
            break
    return tax


def niit(
    magi: float,
    investment_income: float,
    threshold: float,
    rate: float,
) -> float:
    """Net Investment Income Tax: rate applied to lesser of investment income or MAGI excess."""
    excess = max(0.0, magi - threshold)
    return min(investment_income, excess) * rate


def medicare_surtax(
    wages_plus_se: float,
    threshold: float,
    rate: float,
) -> float:
    """Additional 0.9% Medicare tax on wages/SE income above threshold."""
    return max(0.0, wages_plus_se - threshold) * rate


def state_tax(taxable: float, ss: float, plan: PlanInput) -> float:
    """Flat-rate state tax. Excludes SS from taxable base when state_taxes_ss=False."""
    cfg = plan.tax
    if cfg.state_flat_rate <= 0:
        return 0.0
    base = taxable
    if not cfg.state_taxes_ss:
        base = max(0.0, base - ss)
    return base * cfg.state_flat_rate
