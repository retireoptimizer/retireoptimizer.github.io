from typing import Literal

from pydantic import BaseModel, Field, model_validator

StreamKind = Literal[
    "salary",
    "pension",
    "rental",
    "annuity_taxable",
    "annuity_taxfree",
    "ss_a",
    "ss_b",
    "other_income",
    "essential_expense",
    "discretionary_expense",
    "healthcare",
    "ltc",
]


class StreamSchedule(BaseModel):
    start_year: int
    end_year: int
    annual_amount_today: float
    inflation_indexed: bool = True
    growth_rate: float | None = None

    @model_validator(mode="after")
    def end_after_start(self) -> "StreamSchedule":
        if self.end_year < self.start_year:
            raise ValueError("end_year must be >= start_year")
        return self


class IncomeStream(BaseModel):
    id: str
    label: str
    kind: StreamKind
    owner: Literal["A", "B", "Joint"] = "Joint"
    taxable_pct: float = Field(ge=0, le=1, default=1.0)
    schedule: StreamSchedule


class ExpenseStream(BaseModel):
    id: str
    label: str
    kind: StreamKind
    schedule: StreamSchedule
