"""Minimal in-memory factories for building valid PlanInput objects in tests."""

from datetime import date

from fireopt.schemas.conversion import RothConversionConfig
from fireopt.schemas.market import MarketAssumptions
from fireopt.schemas.plan_input import BucketBalances, PersonInfo, PlanHorizon, PlanInput
from fireopt.schemas.tax import TaxConfig


def make_person(
    name: str = "Alice",
    birth_year: int = 1960,
    ss_pia_monthly: float = 2000,
) -> PersonInfo:
    return PersonInfo(
        name=name,
        birth_date=date(birth_year, 1, 1),
        ss_claim_age=67,
        ss_pia_monthly=ss_pia_monthly,
        life_expectancy_age=95,
    )


def make_plan(
    state: str = "NONE",
    state_flat_rate: float = 0.0,
    state_taxes_ss: bool = False,
    pretax: float = 500_000,
    taxable: float = 200_000,
    roth: float = 100_000,
) -> PlanInput:
    return PlanInput(
        person_a=make_person("Alice", 1960),
        person_b=make_person("Bob", 1962),
        horizon=PlanHorizon(start_year=2025, horizon_years=30),
        starting_balances=BucketBalances(
            taxable=taxable,
            pretax=pretax,
            roth=roth,
            taxable_cost_basis=taxable * 0.6,
        ),
        market=MarketAssumptions(),
        tax=TaxConfig(state_flat_rate=state_flat_rate, state_taxes_ss=state_taxes_ss),
        conversion=RothConversionConfig(),
    )
