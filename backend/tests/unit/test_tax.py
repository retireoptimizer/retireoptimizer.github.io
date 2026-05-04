import pytest

from fireopt.engine.constants import (
    FEDERAL_BRACKETS_LTCG_MFJ_2025,
    FEDERAL_BRACKETS_ORDINARY_MFJ_2025,
    NIIT_RATE,
    NIIT_THRESHOLD_MFJ,
    STANDARD_DEDUCTION_MFJ_2025,
)
from fireopt.engine.tax import federal_ordinary_tax, ltcg_tax, medicare_surtax, niit, state_tax
from tests.fixtures.factories import make_plan

# Short aliases to keep lines ≤100 chars
_ORD = FEDERAL_BRACKETS_ORDINARY_MFJ_2025
_LTCG = FEDERAL_BRACKETS_LTCG_MFJ_2025
_STD = STANDARD_DEDUCTION_MFJ_2025


# ---------------------------------------------------------------------------
# federal_ordinary_tax
# ---------------------------------------------------------------------------


def test_federal_ordinary_tax_zero_income():
    assert federal_ordinary_tax(0, _ORD, _STD) == 0.0


def test_federal_ordinary_tax_below_std_deduction():
    # Gross below std deduction → zero tax
    assert federal_ordinary_tax(20_000, _ORD, _STD) == 0.0


def test_federal_ordinary_tax_single_bracket():
    # $40,000 gross → $10,000 AGI (all in 10% bracket)
    tax = federal_ordinary_tax(40_000, _ORD, _STD)
    assert tax == pytest.approx(10_000 * 0.10)


def test_federal_ordinary_tax_two_brackets():
    # $60,000 gross → $30,000 AGI
    # 10% on first $23,200 = $2,320
    # 12% on remaining $6,800 = $816
    tax = federal_ordinary_tax(60_000, _ORD, _STD)
    assert tax == pytest.approx(2_320 + 816, rel=1e-6)


def test_federal_ordinary_tax_spans_many_brackets():
    # $450,000 gross → $420,000 AGI
    # 10%:  $23,200             = $2,320.00
    # 12%:  $94,300-$23,200     = $8,532.00
    # 22%:  $201,050-$94,300    = $23,485.00
    # 24%:  $383,900-$201,050   = $43,884.00
    # 32%:  $420,000-$383,900   = $11,552.00
    expected = 2_320 + 8_532 + 23_485 + 43_884 + 11_552
    tax = federal_ordinary_tax(450_000, _ORD, _STD)
    assert tax == pytest.approx(expected, rel=1e-6)


def test_federal_ordinary_tax_top_bracket():
    # $1M gross → in 37% bracket for the remainder
    tax = federal_ordinary_tax(1_000_000, _ORD, _STD)
    assert tax > 0
    # Effective rate must be below 37%
    agi = 1_000_000 - _STD
    assert tax / agi < 0.37


def test_federal_ordinary_tax_negative_income_treated_as_zero():
    tax = federal_ordinary_tax(-10_000, _ORD, _STD)
    assert tax == 0.0


# ---------------------------------------------------------------------------
# ltcg_tax
# ---------------------------------------------------------------------------


def test_ltcg_tax_zero():
    assert ltcg_tax(0, 50_000, _LTCG) == 0.0


def test_ltcg_tax_zero_rate_low_income():
    # Ordinary $20k + LTCG $30k = $50k total, still in 0% LTCG band (≤$96,700)
    tax = ltcg_tax(30_000, 20_000, _LTCG)
    assert tax == 0.0


def test_ltcg_tax_zero_rate_ordinary_fills_bracket():
    # Ordinary $80k + LTCG $10k → total $90k, still ≤ $96,700 threshold
    tax = ltcg_tax(10_000, 80_000, _LTCG)
    assert tax == 0.0


def test_ltcg_tax_partly_in_15pct():
    # Ordinary $90k, LTCG $20k → ordinary fills to $90k, then $6,700 of LTCG is at 0%,
    # remaining $13,300 at 15%
    tax = ltcg_tax(20_000, 90_000, _LTCG)
    assert tax == pytest.approx(13_300 * 0.15, rel=1e-6)


def test_ltcg_tax_all_15pct():
    # Ordinary $200k (already past 0% LTCG band), LTCG $50k → all at 15%
    tax = ltcg_tax(50_000, 200_000, _LTCG)
    assert tax == pytest.approx(50_000 * 0.15, rel=1e-6)


def test_ltcg_tax_20pct_bracket():
    # Ordinary $570k + LTCG $50k → $20k at 15%, $30k at 20%
    tax = ltcg_tax(50_000, 570_000, _LTCG)
    assert tax == pytest.approx(13_750 * 0.15 + 36_250 * 0.20, rel=1e-4)


# ---------------------------------------------------------------------------
# niit
# ---------------------------------------------------------------------------


def test_niit_below_threshold():
    assert niit(200_000, 20_000, NIIT_THRESHOLD_MFJ, NIIT_RATE) == 0.0


def test_niit_at_threshold():
    assert niit(250_000, 20_000, NIIT_THRESHOLD_MFJ, NIIT_RATE) == 0.0


def test_niit_above_threshold_investment_is_limiting():
    # MAGI $300k excess = $50k; investment income $20k < excess → tax on $20k
    tax = niit(300_000, 20_000, NIIT_THRESHOLD_MFJ, NIIT_RATE)
    assert tax == pytest.approx(20_000 * NIIT_RATE, rel=1e-9)


def test_niit_above_threshold_excess_is_limiting():
    # MAGI $260k excess = $10k; investment income $50k > excess → tax on $10k
    tax = niit(260_000, 50_000, NIIT_THRESHOLD_MFJ, NIIT_RATE)
    assert tax == pytest.approx(10_000 * NIIT_RATE, rel=1e-9)


def test_niit_zero_investment_income():
    assert niit(500_000, 0, NIIT_THRESHOLD_MFJ, NIIT_RATE) == 0.0


# ---------------------------------------------------------------------------
# medicare_surtax
# ---------------------------------------------------------------------------


def test_medicare_surtax_below_threshold():
    assert medicare_surtax(150_000, 200_000, 0.009) == 0.0


def test_medicare_surtax_above_threshold():
    tax = medicare_surtax(250_000, 200_000, 0.009)
    assert tax == pytest.approx(50_000 * 0.009, rel=1e-9)


def test_medicare_surtax_zero_wages():
    assert medicare_surtax(0, 200_000, 0.009) == 0.0


# ---------------------------------------------------------------------------
# state_tax
# ---------------------------------------------------------------------------


def test_state_tax_no_state():
    plan = make_plan(state_flat_rate=0.0)
    assert state_tax(100_000, 20_000, plan) == 0.0


def test_state_tax_flat_rate_no_ss_exclusion():
    plan = make_plan(state_flat_rate=0.05, state_taxes_ss=True)
    assert state_tax(100_000, 20_000, plan) == pytest.approx(5_000.0)


def test_state_tax_flat_rate_with_ss_exclusion():
    # SS excluded from taxable base
    plan = make_plan(state_flat_rate=0.05, state_taxes_ss=False)
    assert state_tax(100_000, 20_000, plan) == pytest.approx(80_000 * 0.05)


def test_state_tax_ss_larger_than_taxable():
    # Should not produce negative tax
    plan = make_plan(state_flat_rate=0.05, state_taxes_ss=False)
    assert state_tax(10_000, 50_000, plan) == 0.0
