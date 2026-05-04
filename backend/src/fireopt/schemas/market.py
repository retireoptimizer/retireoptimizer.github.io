from typing import Literal

from pydantic import BaseModel, Field


class MarketAssumptions(BaseModel):
    expected_return: float = Field(ge=-0.10, le=0.20, default=0.06)
    volatility: float = Field(ge=0, le=0.40, default=0.12)
    taxable_drag: float = Field(ge=0, le=0.05, default=0.005)
    correlation_a_b: float = 0.0
    distribution: Literal["normal", "lognormal"] = "normal"
