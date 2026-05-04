import pytest

from fireopt.engine.constants import SS_MAX_TAXABLE_PCT, SS_THRESH_LOW_MFJ
from fireopt.engine.ss import social_security_annual, survivor_benefit, taxable_ss_portion
from tests.fixtures.factories import make_person

# ---------------------------------------------------------------------------
# social_security_annual
# ---------------------------------------------------------------------------


def test_ss_annual_before_claim_year():
    # birth 1955, claim age 67 → claim_year 2022
    person = make_person(birth_year=1955)
    assert social_security_annual(person, 2021, cpi_factor=1.0) == 0.0


def test_ss_annual_at_claim_year():
    person = make_person(birth_year=1955, ss_pia_monthly=2000)
    benefit = social_security_annual(person, 2022, cpi_factor=1.0)
    assert benefit == pytest.approx(2_000 * 12)


def test_ss_annual_after_claim_year():
    person = make_person(birth_year=1955, ss_pia_monthly=2000)
    assert social_security_annual(person, 2030, cpi_factor=1.0) == pytest.approx(24_000)


def test_ss_annual_with_cpi_factor():
    person = make_person(birth_year=1955, ss_pia_monthly=2000)
    benefit = social_security_annual(person, 2030, cpi_factor=1.25)
    assert benefit == pytest.approx(2_000 * 12 * 1.25)


def test_ss_annual_zero_pia():
    person = make_person(birth_year=1955, ss_pia_monthly=0)
    assert social_security_annual(person, 2030, cpi_factor=1.5) == 0.0


def test_ss_annual_early_claim_age():
    # birth 1960, claim age 62 → claim_year 2022
    from datetime import date

    from fireopt.schemas.plan_input import PersonInfo

    person = PersonInfo(
        name="Early",
        birth_date=date(1960, 1, 1),
        ss_claim_age=62,
        ss_pia_monthly=1500,
        life_expectancy_age=95,
    )
    assert social_security_annual(person, 2021, cpi_factor=1.0) == 0.0
    assert social_security_annual(person, 2022, cpi_factor=1.0) == pytest.approx(1_500 * 12)


# ---------------------------------------------------------------------------
# survivor_benefit
# ---------------------------------------------------------------------------


def test_survivor_both_alive():
    assert survivor_benefit(20_000, 15_000, True, True) == pytest.approx(35_000)


def test_survivor_a_alive_b_dead_a_higher():
    assert survivor_benefit(20_000, 15_000, True, False) == pytest.approx(20_000)


def test_survivor_a_alive_b_dead_b_higher():
    # B had a higher benefit; A inherits it
    assert survivor_benefit(15_000, 25_000, True, False) == pytest.approx(25_000)


def test_survivor_b_alive_a_dead_a_higher():
    # A had higher; B gets A's benefit
    assert survivor_benefit(30_000, 15_000, False, True) == pytest.approx(30_000)


def test_survivor_b_alive_a_dead_b_higher():
    assert survivor_benefit(15_000, 30_000, False, True) == pytest.approx(30_000)


def test_survivor_both_dead():
    assert survivor_benefit(20_000, 15_000, False, False) == 0.0


def test_survivor_equal_benefits():
    assert survivor_benefit(20_000, 20_000, True, False) == pytest.approx(20_000)


# ---------------------------------------------------------------------------
# taxable_ss_portion — MFJ
# ---------------------------------------------------------------------------


def test_taxable_ss_below_low_threshold():
    assert taxable_ss_portion(20_000, 10_000, "MFJ") == 0.0


def test_taxable_ss_at_low_threshold():
    assert taxable_ss_portion(SS_THRESH_LOW_MFJ, 10_000, "MFJ") == 0.0


def test_taxable_ss_in_middle_band():
    # PI=$38k → 0.50 × ($38k − $32k) = $3,000
    result = taxable_ss_portion(38_000, 50_000, "MFJ")
    assert result == pytest.approx(3_000)


def test_taxable_ss_at_high_threshold():
    # PI=$44k → 0.50 × ($44k − $32k) = $6,000
    result = taxable_ss_portion(44_000, 50_000, "MFJ")
    assert result == pytest.approx(6_000)


def test_taxable_ss_above_high_threshold():
    # PI=$60k → $6,000 + 0.85 × ($60k − $44k) = $6,000 + $13,600 = $19,600
    result = taxable_ss_portion(60_000, 50_000, "MFJ")
    assert result == pytest.approx(6_000 + 0.85 * 16_000, rel=1e-9)


def test_taxable_ss_capped_at_85pct():
    # Very high PI, small SS → cap at 85% × total_ss
    result = taxable_ss_portion(500_000, 10_000, "MFJ")
    assert result == pytest.approx(SS_MAX_TAXABLE_PCT * 10_000)


# ---------------------------------------------------------------------------
# taxable_ss_portion — Single
# ---------------------------------------------------------------------------


def test_taxable_ss_single_below_threshold():
    assert taxable_ss_portion(20_000, 10_000, "Single") == 0.0


def test_taxable_ss_single_in_middle_band():
    # PI=$30k, low=$25k → 0.50 × ($30k − $25k) = $2,500
    result = taxable_ss_portion(30_000, 50_000, "Single")
    assert result == pytest.approx(2_500)


def test_taxable_ss_single_above_high_threshold():
    # PI=$40k, low=$25k, high=$34k
    # tier1 = 0.50 × ($34k − $25k) = $4,500
    # tier2 = 0.85 × ($40k − $34k) = $5,100
    result = taxable_ss_portion(40_000, 50_000, "Single")
    assert result == pytest.approx(0.50 * 9_000 + 0.85 * 6_000, rel=1e-9)
