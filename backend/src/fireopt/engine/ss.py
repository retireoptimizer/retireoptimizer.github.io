from fireopt.engine.constants import (
    SS_MAX_TAXABLE_PCT,
    SS_THRESH_HIGH_MFJ,
    SS_THRESH_HIGH_SINGLE,
    SS_THRESH_LOW_MFJ,
    SS_THRESH_LOW_SINGLE,
)
from fireopt.schemas.plan_input import FilingStatus, PersonInfo


def social_security_annual(
    person: PersonInfo,
    year: int,
    cpi_factor: float,
) -> float:
    """Annual SS benefit in current-year dollars.

    cpi_factor is the cumulative CPI multiplier from the plan's base year to `year`.
    Returns 0.0 before the claim year or when PIA is zero.
    """
    claim_year = person.birth_date.year + person.ss_claim_age
    if year < claim_year or person.ss_pia_monthly <= 0:
        return 0.0
    return person.ss_pia_monthly * 12 * cpi_factor


def survivor_benefit(
    a_annual: float,
    b_annual: float,
    a_alive: bool,
    b_alive: bool,
) -> float:
    """Total household SS income applying IRS survivor rules.

    Survivor receives the greater of their own benefit or the deceased spouse's benefit.
    """
    if a_alive and b_alive:
        return a_annual + b_annual
    if a_alive:
        return max(a_annual, b_annual)
    if b_alive:
        return max(a_annual, b_annual)
    return 0.0


def taxable_ss_portion(
    provisional_income: float,
    total_ss: float,
    filing_status: FilingStatus,
) -> float:
    """IRS combined-income formula: taxable share of SS benefits.

    provisional_income = MAGI (ex-SS) + 50% of SS + tax-exempt interest.
    Capped at 85% of total_ss.
    """
    if filing_status == "MFJ":
        low, high = SS_THRESH_LOW_MFJ, SS_THRESH_HIGH_MFJ
    else:
        low, high = SS_THRESH_LOW_SINGLE, SS_THRESH_HIGH_SINGLE

    if provisional_income <= low:
        return 0.0
    if provisional_income <= high:
        taxable = 0.50 * (provisional_income - low)
    else:
        taxable = 0.50 * (high - low) + 0.85 * (provisional_income - high)
    return min(taxable, SS_MAX_TAXABLE_PCT * total_ss)
