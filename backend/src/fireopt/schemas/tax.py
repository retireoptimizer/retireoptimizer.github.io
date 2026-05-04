
from pydantic import BaseModel, Field


class TaxBracket(BaseModel):
    rate: float = Field(ge=0, le=1)
    upper: float | None = None  # None = top bracket (no cap)


class TaxConfig(BaseModel):
    use_2025_mfj_default: bool = True
    federal_brackets_ordinary: list[TaxBracket] = Field(default_factory=list)
    federal_brackets_ltcg: list[TaxBracket] = Field(default_factory=list)
    standard_deduction: float = 30000
    cpi_inflation_rate: float = Field(ge=0, le=0.10, default=0.025)
    state_flat_rate: float = Field(ge=0, le=0.15, default=0.0)
    state_taxes_ss: bool = False
    niit_threshold_mfj: float = 250000
    niit_rate: float = 0.038
    medicare_surtax_threshold_mfj: float = 250000
    medicare_surtax_rate: float = 0.009
