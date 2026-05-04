import pytest

from fireopt.engine.withdrawal import WithdrawalBreakdown, withdraw_to_cover
from fireopt.schemas.plan_input import BucketBalances, WithdrawalPolicy


def _bal(
    taxable: float = 200_000, pretax: float = 500_000, roth: float = 100_000
) -> BucketBalances:
    return BucketBalances(taxable=taxable, pretax=pretax, roth=roth, taxable_cost_basis=0)


# ---------------------------------------------------------------------------
# WithdrawalBreakdown.total
# ---------------------------------------------------------------------------


def test_total_property():
    wb = WithdrawalBreakdown(taxable=100, pretax=200, roth=300)
    assert wb.total == 600


# ---------------------------------------------------------------------------
# zero / negative need
# ---------------------------------------------------------------------------


def test_zero_need_returns_all_zeros():
    result = withdraw_to_cover(0, WithdrawalPolicy(), _bal())
    assert result.total == 0.0
    assert result.shortfall == 0.0


def test_negative_need_returns_all_zeros():
    result = withdraw_to_cover(-1_000, WithdrawalPolicy(), _bal())
    assert result.total == 0.0


# ---------------------------------------------------------------------------
# mode: default_order
# ---------------------------------------------------------------------------


def test_default_order_single_bucket():
    result = withdraw_to_cover(50_000, WithdrawalPolicy(), _bal(taxable=200_000))
    assert result.taxable == pytest.approx(50_000)
    assert result.pretax == 0.0
    assert result.roth == 0.0
    assert result.shortfall == 0.0


def test_default_order_spans_two_buckets():
    result = withdraw_to_cover(250_000, WithdrawalPolicy(), _bal(taxable=200_000))
    assert result.taxable == pytest.approx(200_000)
    assert result.pretax == pytest.approx(50_000)
    assert result.roth == 0.0
    assert result.shortfall == 0.0


def test_default_order_spans_all_three_buckets():
    result = withdraw_to_cover(600_000, WithdrawalPolicy(), _bal())
    assert result.taxable == pytest.approx(200_000)
    assert result.pretax == pytest.approx(400_000)
    assert result.roth == 0.0
    assert result.shortfall == 0.0


def test_default_order_exhausts_all_with_shortfall():
    result = withdraw_to_cover(900_000, WithdrawalPolicy(), _bal())
    assert result.taxable == pytest.approx(200_000)
    assert result.pretax == pytest.approx(500_000)
    assert result.roth == pytest.approx(100_000)
    assert result.shortfall == pytest.approx(100_000)


def test_default_order_exact_balance_no_shortfall():
    result = withdraw_to_cover(800_000, WithdrawalPolicy(), _bal())
    assert result.total == pytest.approx(800_000)
    assert result.shortfall == 0.0


def test_default_order_custom_order():
    policy = WithdrawalPolicy(mode="default_order", default_order=["roth", "pretax", "taxable"])
    result = withdraw_to_cover(50_000, policy, _bal(roth=100_000))
    assert result.roth == pytest.approx(50_000)
    assert result.pretax == 0.0
    assert result.taxable == 0.0


def test_default_order_zero_balance_bucket_skipped():
    result = withdraw_to_cover(50_000, WithdrawalPolicy(), _bal(taxable=0, pretax=500_000))
    assert result.taxable == 0.0
    assert result.pretax == pytest.approx(50_000)


# ---------------------------------------------------------------------------
# mode: optimized (falls back to default_order)
# ---------------------------------------------------------------------------


def test_optimized_behaves_like_default_order():
    policy = WithdrawalPolicy(mode="optimized")
    result = withdraw_to_cover(50_000, policy, _bal(taxable=200_000))
    assert result.taxable == pytest.approx(50_000)
    assert result.shortfall == 0.0


# ---------------------------------------------------------------------------
# mode: split
# ---------------------------------------------------------------------------


def test_split_proportional():
    policy = WithdrawalPolicy(mode="split", split_pct={"taxable": 0.5, "pretax": 0.5})
    result = withdraw_to_cover(100_000, policy, _bal())
    assert result.taxable == pytest.approx(50_000)
    assert result.pretax == pytest.approx(50_000)
    assert result.roth == 0.0
    assert result.shortfall == 0.0


def test_split_constrained_by_bucket_balance():
    # taxable target = 50k but only 20k available
    policy = WithdrawalPolicy(mode="split", split_pct={"taxable": 0.5, "pretax": 0.5})
    result = withdraw_to_cover(100_000, policy, _bal(taxable=20_000, pretax=500_000))
    assert result.taxable == pytest.approx(20_000)
    assert result.pretax == pytest.approx(50_000)
    assert result.shortfall == pytest.approx(30_000)


def test_split_three_way():
    policy = WithdrawalPolicy(mode="split", split_pct={"taxable": 0.4, "pretax": 0.4, "roth": 0.2})
    result = withdraw_to_cover(100_000, policy, _bal())
    assert result.taxable == pytest.approx(40_000)
    assert result.pretax == pytest.approx(40_000)
    assert result.roth == pytest.approx(20_000)
    assert result.shortfall == 0.0
