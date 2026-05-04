import uuid

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api.errors import fireopt_exception_handler
from .api.v1.router import router as v1_router
from .config import settings
from .exceptions import FireOptError
from .logging import configure_logging

configure_logging()
logger = structlog.get_logger()

app = FastAPI(
    title="FireOpt API",
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


app.add_exception_handler(FireOptError, fireopt_exception_handler)  # type: ignore[arg-type]
app.include_router(v1_router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "version": settings.app_version}
