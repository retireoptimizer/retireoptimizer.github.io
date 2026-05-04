from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from .plan_input import PlanInput
    from .projection_output import ProjectionResult

from .conversion import ManualConversionEntry

OptGoal = Literal["min_tax", "max_heirs", "max_spend", "max_success"]
OptAlgo = Literal["slsqp", "cobyla", "differential_evolution"]


class OptimizerConfig(BaseModel):
    plan: "PlanInput"
    goal: OptGoal
    algorithm: OptAlgo = "slsqp"
    max_iterations: int = Field(ge=10, le=500, default=100)
    optimize_conversions: bool = True
    optimize_withdrawal_split: bool = True
    conversion_year_range: tuple[int, int] | None = None
    monte_carlo_paths: int = 200


class OptimizerResult(BaseModel):
    job_id: str
    goal: OptGoal
    objective_value: float
    baseline_value: float
    improvement_pct: float
    optimized_conversions: list[ManualConversionEntry]
    optimized_withdrawal_splits: dict[int, dict[str, float]]
    projection: "ProjectionResult"
    iterations: int
    converged: bool
    runtime_ms: int
    insights: list[str]


from .plan_input import PlanInput  # noqa: E402
from .projection_output import ProjectionResult  # noqa: E402

OptimizerConfig.model_rebuild()
OptimizerResult.model_rebuild()
