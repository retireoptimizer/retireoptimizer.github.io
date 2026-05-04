class FireOptError(Exception):
    code: str = "FIREOPT_ERROR"
    http_status: int = 500


class ValidationError(FireOptError):
    code = "VALIDATION_ERROR"
    http_status = 422


class PlanInfeasibleError(FireOptError):
    code = "PLAN_INFEASIBLE"
    http_status = 409


class OptimizerFailedError(FireOptError):
    code = "OPT_FAILED"
    http_status = 500


class AuthError(FireOptError):
    code = "AUTH_ERROR"
    http_status = 401


class NotFoundError(FireOptError):
    code = "NOT_FOUND"
    http_status = 404


class RateLimitError(FireOptError):
    code = "RATE_LIMITED"
    http_status = 429
