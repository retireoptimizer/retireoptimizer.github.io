import pytest

from fireopt.engine.streams import aggregate_streams, stream_amount_in_year
from fireopt.schemas.streams import ExpenseStream, IncomeStream, StreamSchedule
from tests.fixtures.factories import make_plan


def _income(
    *,
    id: str = "i1",
    kind: str = "salary",
    start: int = 2025,
    end: int = 2034,
    amount: float = 50_000,
    taxable_pct: float = 1.0,
    inflation_indexed: bool = True,
    growth_rate: float | None = None,
) -> IncomeStream:
    return IncomeStream(
        id=id,
        label="Income",
        kind=kind,  # type: ignore[arg-type]
        taxable_pct=taxable_pct,
        schedule=StreamSchedule(
            start_year=start,
            end_year=end,
            annual_amount_today=amount,
            inflation_indexed=inflation_indexed,
            growth_rate=growth_rate,
        ),
    )


def _expense(
    *,
    id: str = "e1",
    kind: str = "essential_expense",
    start: int = 2025,
    end: int = 2054,
    amount: float = 40_000,
    inflation_indexed: bool = True,
) -> ExpenseStream:
    return ExpenseStream(
        id=id,
        label="Expense",
        kind=kind,  # type: ignore[arg-type]
        schedule=StreamSchedule(
            start_year=start,
            end_year=end,
            annual_amount_today=amount,
            inflation_indexed=inflation_indexed,
        ),
    )


# ---------------------------------------------------------------------------
# stream_amount_in_year
# ---------------------------------------------------------------------------


def test_stream_before_start_year():
    s = _income(start=2026)
    assert stream_amount_in_year(s, 2025, 1.03, 2025) == 0.0


def test_stream_after_end_year():
    s = _income(end=2030)
    assert stream_amount_in_year(s, 2031, 1.0, 2025) == 0.0


def test_stream_at_start_year_not_indexed():
    s = _income(start=2025, amount=50_000, inflation_indexed=False)
    assert stream_amount_in_year(s, 2025, 1.03, 2025) == pytest.approx(50_000)


def test_stream_inflation_indexed_base_year():
    # cpi_factor=1.03 applies even in base year (caller controls it)
    s = _income(start=2025, amount=50_000, inflation_indexed=True)
    assert stream_amount_in_year(s, 2025, 1.03, 2025) == pytest.approx(50_000 * 1.03)


def test_stream_not_inflation_indexed_ignores_cpi():
    s = _income(start=2025, amount=50_000, inflation_indexed=False)
    assert stream_amount_in_year(s, 2030, 1.15, 2025) == pytest.approx(50_000)


def test_stream_custom_growth_rate():
    s = _income(start=2025, amount=100_000, growth_rate=0.05)
    result = stream_amount_in_year(s, 2030, 1.15, 2025)
    assert result == pytest.approx(100_000 * 1.05**5, rel=1e-9)


def test_stream_growth_rate_base_year_zero_growth():
    s = _income(start=2025, amount=100_000, growth_rate=0.05)
    assert stream_amount_in_year(s, 2025, 1.0, 2025) == pytest.approx(100_000)


def test_stream_at_end_year():
    s = _income(start=2025, end=2030, amount=60_000, inflation_indexed=False)
    assert stream_amount_in_year(s, 2030, 1.5, 2025) == pytest.approx(60_000)


def test_expense_stream_in_range():
    s = _expense(start=2025, end=2054, amount=40_000, inflation_indexed=False)
    assert stream_amount_in_year(s, 2040, 1.5, 2025) == pytest.approx(40_000)


# ---------------------------------------------------------------------------
# aggregate_streams
# ---------------------------------------------------------------------------


def test_aggregate_empty_plan():
    plan = make_plan()
    result = aggregate_streams(plan, 2025, 1.0, 2025)
    assert result.gross_income == 0.0
    assert result.taxable_income == 0.0
    assert result.expenses == 0.0


def test_aggregate_year_field():
    plan = make_plan()
    result = aggregate_streams(plan, 2031, 1.0, 2025)
    assert result.year == 2031


def test_aggregate_single_income_full_taxable():
    plan = make_plan()
    plan.income_streams.append(_income(amount=60_000, taxable_pct=1.0, inflation_indexed=False))
    result = aggregate_streams(plan, 2025, 1.0, 2025)
    assert result.gross_income == pytest.approx(60_000)
    assert result.taxable_income == pytest.approx(60_000)


def test_aggregate_partial_taxable():
    plan = make_plan()
    plan.income_streams.append(_income(amount=60_000, taxable_pct=0.8, inflation_indexed=False))
    result = aggregate_streams(plan, 2025, 1.0, 2025)
    assert result.gross_income == pytest.approx(60_000)
    assert result.taxable_income == pytest.approx(48_000)


def test_aggregate_multiple_income_streams():
    plan = make_plan()
    plan.income_streams.append(_income(id="i1", amount=50_000, taxable_pct=1.0,
                                       inflation_indexed=False))
    plan.income_streams.append(_income(id="i2", amount=30_000, taxable_pct=0.5,
                                       inflation_indexed=False))
    result = aggregate_streams(plan, 2025, 1.0, 2025)
    assert result.gross_income == pytest.approx(80_000)
    assert result.taxable_income == pytest.approx(65_000)


def test_aggregate_expense_only():
    plan = make_plan()
    plan.expense_streams.append(_expense(amount=40_000, inflation_indexed=False))
    result = aggregate_streams(plan, 2025, 1.0, 2025)
    assert result.expenses == pytest.approx(40_000)
    assert result.gross_income == 0.0


def test_aggregate_income_and_expense():
    plan = make_plan()
    plan.income_streams.append(_income(amount=80_000, taxable_pct=1.0, inflation_indexed=False))
    plan.expense_streams.append(_expense(amount=50_000, inflation_indexed=False))
    result = aggregate_streams(plan, 2025, 1.0, 2025)
    assert result.gross_income == pytest.approx(80_000)
    assert result.expenses == pytest.approx(50_000)


def test_aggregate_stream_out_of_range_excluded():
    plan = make_plan()
    plan.income_streams.append(
        _income(start=2030, end=2040, amount=50_000, inflation_indexed=False)
    )
    result = aggregate_streams(plan, 2025, 1.0, 2025)
    assert result.gross_income == 0.0


def test_aggregate_cpi_applied_to_indexed_stream():
    plan = make_plan()
    plan.income_streams.append(_income(amount=50_000, inflation_indexed=True, taxable_pct=1.0))
    result = aggregate_streams(plan, 2030, 1.15, 2025)
    assert result.gross_income == pytest.approx(50_000 * 1.15)
