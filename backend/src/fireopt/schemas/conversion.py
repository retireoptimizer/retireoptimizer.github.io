from typing import Literal

from pydantic import BaseModel, Field

ConversionMode = Literal["off", "manual", "bracket_fill", "bracket_cap"]


class ManualConversionEntry(BaseModel):
    year: int
    amount: float = Field(ge=0)


class RothConversionConfig(BaseModel):
    mode: ConversionMode = "off"
    manual_entries: list[ManualConversionEntry] = Field(default_factory=list)
    bracket_fill_target_rate: float = Field(ge=0, le=1, default=0.24)
    bracket_cap_max_amount: float = Field(ge=0, default=0)
    start_year: int | None = None
    end_year: int | None = None
