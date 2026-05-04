from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from .plan_input import PlanInput


class MCRequest(BaseModel):
    plan: "PlanInput"
    paths: int = Field(ge=100, le=5000, default=1000)
    seed: int | None = None


class MCBands(BaseModel):
    year: int
    p10: float
    p25: float
    p50: float
    p75: float
    p90: float


class MCResult(BaseModel):
    plan_hash: str
    paths: int
    success_rate: float
    median_final_balance: float
    bands: list[MCBands]
    runtime_ms: int


from .plan_input import PlanInput  # noqa: E402

MCRequest.model_rebuild()
