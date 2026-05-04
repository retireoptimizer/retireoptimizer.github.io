from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator

FilingStatus = Literal["MFJ", "Single"]

StateCode = Literal[
    "NONE", "CA", "NY", "TX", "FL", "WA", "OR", "CO", "AZ", "NV",
    "IL", "MA", "NJ", "PA", "VA", "NC", "GA", "OH", "MI", "MN", "WI", "Other",
]


class PersonInfo(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    birth_date: date
    ss_claim_age: int = Field(ge=62, le=70, default=67)
    ss_pia_monthly: float = Field(ge=0, default=0)
    life_expectancy_age: int = Field(ge=70, le=120, default=95)


class BucketBalances(BaseModel):
    taxable: float = Field(ge=0, default=0)
    pretax: float = Field(ge=0, default=0)
    roth: float = Field(ge=0, default=0)
    taxable_cost_basis: float = Field(ge=0, default=0)

    @model_validator(mode="after")
    def basis_le_taxable(self) -> "BucketBalances":
        if self.taxable_cost_basis > self.taxable:
            raise ValueError("taxable_cost_basis cannot exceed taxable balance")
        return self


class PlanHorizon(BaseModel):
    start_year: int = Field(ge=2024, le=2100)
    horizon_years: int = Field(ge=1, le=80, default=75)


BucketName = Literal["taxable", "pretax", "roth"]


def _default_withdrawal_order() -> list[BucketName]:
    return ["taxable", "pretax", "roth"]


class WithdrawalPolicy(BaseModel):
    mode: Literal["default_order", "split", "optimized"] = "default_order"
    default_order: list[BucketName] = Field(default_factory=_default_withdrawal_order)
    split_pct: dict[str, float] | None = None


class PlanInput(BaseModel):
    plan_id: str | None = None
    name: str = Field(default="Untitled", max_length=128)
    person_a: PersonInfo
    person_b: PersonInfo
    filing_status: FilingStatus = "MFJ"
    state: StateCode = "NONE"
    horizon: PlanHorizon
    starting_balances: BucketBalances
    income_streams: list["IncomeStream"] = Field(default_factory=list)
    expense_streams: list["ExpenseStream"] = Field(default_factory=list)
    market: "MarketAssumptions"
    tax: "TaxConfig"
    conversion: "RothConversionConfig"
    withdrawal_policy: WithdrawalPolicy = Field(default_factory=WithdrawalPolicy)


from .conversion import RothConversionConfig  # noqa: E402
from .market import MarketAssumptions  # noqa: E402
from .streams import ExpenseStream, IncomeStream  # noqa: E402
from .tax import TaxConfig  # noqa: E402

PlanInput.model_rebuild()
