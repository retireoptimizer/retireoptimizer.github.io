import pytest

from fireopt.engine.constants import RMD_START_AGE, UNIFORM_LIFETIME_TABLE
from fireopt.engine.rmd import required_min_distribution, uniform_lifetime_factor

# ---------------------------------------------------------------------------
# uniform_lifetime_factor
# ---------------------------------------------------------------------------


def test_ult_known_values():
    assert uniform_lifetime_factor(73) == 26.5
    assert uniform_lifetime_factor(75) == 24.6
    assert uniform_lifetime_factor(80) == 20.2
    assert uniform_lifetime_factor(90) == 12.2
    assert uniform_lifetime_factor(100) == 6.4
    assert uniform_lifetime_factor(120) == 2.0


def test_ult_all_table_entries_present():
    for age in range(73, 121):
        factor = uniform_lifetime_factor(age)
        assert factor > 0


def test_ult_factors_strictly_decreasing():
    factors = [uniform_lifetime_factor(age) for age in range(73, 121)]
    for i in range(len(factors) - 1):
        assert factors[i] > factors[i + 1], f"Factor should decrease from age {73+i} to {74+i}"


def test_ult_below_range_raises():
    with pytest.raises(ValueError, match="ULT not defined"):
        uniform_lifetime_factor(72)


def test_ult_above_range_raises():
    with pytest.raises(ValueError, match="ULT not defined"):
        uniform_lifetime_factor(121)


def test_ult_table_covers_all_ages():
    assert min(UNIFORM_LIFETIME_TABLE.keys()) == 73
    assert max(UNIFORM_LIFETIME_TABLE.keys()) == 120


# ---------------------------------------------------------------------------
# required_min_distribution
# ---------------------------------------------------------------------------


def test_rmd_zero_below_start_age():
    for age in range(60, RMD_START_AGE):
        assert required_min_distribution(500_000, age) == 0.0


def test_rmd_zero_at_one_below_start_age():
    assert required_min_distribution(1_000_000, RMD_START_AGE - 1) == 0.0


def test_rmd_at_start_age():
    balance = 1_000_000.0
    rmd = required_min_distribution(balance, RMD_START_AGE)
    expected = balance / uniform_lifetime_factor(RMD_START_AGE)
    assert rmd == pytest.approx(expected, rel=1e-9)


def test_rmd_age_75():
    # $500k / 24.6 = $20,325.20...
    rmd = required_min_distribution(500_000, 75)
    assert rmd == pytest.approx(500_000 / 24.6, rel=1e-9)


def test_rmd_age_80():
    rmd = required_min_distribution(800_000, 80)
    assert rmd == pytest.approx(800_000 / 20.2, rel=1e-9)


def test_rmd_increases_with_age_same_balance():
    # Older age → smaller factor → larger RMD
    balance = 1_000_000.0
    rmd_73 = required_min_distribution(balance, 73)
    rmd_85 = required_min_distribution(balance, 85)
    rmd_100 = required_min_distribution(balance, 100)
    assert rmd_73 < rmd_85 < rmd_100


def test_rmd_zero_balance():
    assert required_min_distribution(0.0, 75) == 0.0


def test_rmd_proportional_to_balance():
    rmd_1m = required_min_distribution(1_000_000, 80)
    rmd_2m = required_min_distribution(2_000_000, 80)
    assert rmd_2m == pytest.approx(2 * rmd_1m, rel=1e-9)
