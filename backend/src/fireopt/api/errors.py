import uuid
from fastapi import Request
from fastapi.responses import JSONResponse
from ..exceptions import FireOptError


async def fireopt_exception_handler(request: Request, exc: FireOptError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.http_status,
        content={"error": {"code": exc.code, "message": str(exc), "request_id": request_id}},
    )
