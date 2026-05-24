"""
Voice AI Agent — FastAPI application entry point.
"""
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .routers import calls, webhooks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)

app = FastAPI(
    title="Voice AI Agent",
    description="Outbound voice AI agent for appointment reminders and lead qualification.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API routers ────────────────────────────────────────────────────────────────
app.include_router(calls.router, prefix="/api/calls", tags=["calls"])
app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])

# ── Frontend static files ──────────────────────────────────────────────────────
_frontend_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
_frontend_dir = os.path.abspath(_frontend_dir)

if os.path.isdir(_frontend_dir):
    _static_dir = os.path.join(_frontend_dir, "static")
    if os.path.isdir(_static_dir):
        app.mount("/static", StaticFiles(directory=_static_dir), name="static")

    @app.get("/", include_in_schema=False)
    async def serve_index():
        return FileResponse(os.path.join(_frontend_dir, "index.html"))


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok"}
