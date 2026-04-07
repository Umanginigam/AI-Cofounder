"""
FastAPI application — REST + WebSocket API wrapping the core co-founder logic.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api import routes


@asynccontextmanager
async def lifespan(application: FastAPI):
    from src.memory.store import _get_conn
    _get_conn()
    yield


app = FastAPI(
    title="CoFounder AI",
    description="AI co-founder API for solo builders",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router, prefix="/api")
