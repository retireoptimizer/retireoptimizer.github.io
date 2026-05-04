from dataclasses import dataclass

from fireopt.schemas.plan_input import PlanInput
from fireopt.schemas.streams import ExpenseStream, IncomeStream


def stream_amount_in_year(
    stream: IncomeStream | ExpenseStream,
    year: int,
    cpi_factor: float,
    base_year: int,
) -> float:
    """Dollar amount for a stream in `year`.

    cpi_factor is the cumulative CPI multiplier from base_year to year.
    Custom growth_rate overrides inflation_indexed when set.
    """
    sched = stream.schedule
    if year < sched.start_year or year > sched.end_year:
        return 0.0
    base = sched.annual_amount_today
    if sched.growth_rate is not None:
        return base * (1 + sched.growth_rate) ** (year - base_year)
    if sched.inflation_indexed:
        return base * cpi_factor
    return base


@dataclass
class AnnualStreamBreakdown:
    year: int
    gross_income: float = 0.0
    taxable_income: float = 0.0
    expenses: float = 0.0


def aggregate_streams(
    plan: PlanInput,
    year: int,
    cpi_factor: float,
    base_year: int,
) -> AnnualStreamBreakdown:
    """Sum all income and expense streams active in `year`."""
    result = AnnualStreamBreakdown(year=year)
    for inc in plan.income_streams:
        amount = stream_amount_in_year(inc, year, cpi_factor, base_year)
        result.gross_income += amount
        result.taxable_income += amount * inc.taxable_pct
    for exp in plan.expense_streams:
        result.expenses += stream_amount_in_year(exp, year, cpi_factor, base_year)
    return result
