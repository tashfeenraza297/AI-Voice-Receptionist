"""
REST API router — /api/calls/*

Endpoints:
  POST /api/calls/initiate          Kick off an outbound Vapi call
  GET  /api/calls/status/{call_id}  Poll call state + transcript
  GET  /api/calls/active            List all calls in memory
  POST /api/calls/{call_id}/end     Hang up a live call
"""
import uuid
import logging
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from pydantic import BaseModel

from ..config import settings
from ..models.call import CallStatus, InitiateCallRequest, CallResponse
from ..models.scenario import Scenario
from ..services.call_manager import active_calls, CallData
from ..services.vapi_service import VapiService

router = APIRouter()
logger = logging.getLogger(__name__)

# Lazy singleton — avoids crash on startup if keys are missing
_vapi: VapiService | None = None


def get_vapi() -> VapiService:
    global _vapi
    if _vapi is None:
        _vapi = VapiService(settings.VAPI_PRIVATE_KEY, settings.VAPI_PHONE_NUMBER_ID)
    return _vapi


# Vapi status string → our CallStatus enum
_STATUS_MAP: Dict[str, CallStatus] = {
    "queued":       CallStatus.INITIATED,
    "ringing":      CallStatus.RINGING,
    "in-progress":  CallStatus.IN_PROGRESS,
    "forwarding":   CallStatus.IN_PROGRESS,
    "ended":        CallStatus.COMPLETED,
    "failed":       CallStatus.FAILED,
}

# Vapi endedReason → refined terminal status
_ENDED_REASON_MAP: Dict[str, CallStatus] = {
    "busy":         CallStatus.BUSY,
    "no-answer":    CallStatus.NO_ANSWER,
    "voicemail":    CallStatus.NO_ANSWER,
    "failed":       CallStatus.FAILED,
}


def _extract_transcript(vapi_data: Dict[str, Any]) -> list:
    """Pull conversation messages out of a Vapi call object."""
    # Vapi ≥0.x may nest messages under artifact; try both locations
    messages = (
        vapi_data.get("messages")
        or (vapi_data.get("artifact") or {}).get("messages")
        or []
    )
    result = []
    for m in messages:
        role = m.get("role", "")
        text = m.get("message") or m.get("content") or ""
        if role == "bot":
            result.append({"role": "assistant", "content": text})
        elif role == "user":
            result.append({"role": "user", "content": text})
    return result


def _map_vapi_status(vapi_data: Dict[str, Any]) -> CallStatus:
    raw = vapi_data.get("status", "")
    status = _STATUS_MAP.get(raw, CallStatus.INITIATED)
    if status == CallStatus.COMPLETED:
        reason = vapi_data.get("endedReason", "")
        status = _ENDED_REASON_MAP.get(reason, CallStatus.COMPLETED)
    return status


# ---------------------------------------------------------------------------

class _WebConfigRequest(BaseModel):
    scenario_type: str
    scenario_details: Dict[str, Any] = {}


@router.post("/web-config")
async def get_web_config(body: _WebConfigRequest) -> Dict[str, Any]:
    """
    Return the Vapi assistant config + public key so the browser SDK
    can start a WebRTC call without touching the Private key.
    """
    scenario = Scenario(type=body.scenario_type, details=body.scenario_details)
    return {
        "public_key": settings.VAPI_PUBLIC_KEY,
        "assistant": {
            "model": {
                "provider": "openai",
                "model": "gpt-3.5-turbo",
                "messages": [{"role": "system", "content": scenario.get_system_prompt()}],
                "temperature": 0.7,
                "maxTokens": 150,
            },
            "voice": {
                "provider": "openai",
                "voiceId": "nova",
            },
            "transcriber": {
                "provider": "deepgram",
                "model": "nova-2",
                "language": "en",
                "endpointing": 400,
            },
            "firstMessage": scenario.get_opening_message(),
            "endCallMessage": "Goodbye, have a great day!",
            "backgroundDenoisingEnabled": True,
        },
    }


# ---------------------------------------------------------------------------

@router.post("/initiate", response_model=CallResponse, status_code=202)
async def initiate_call(body: InitiateCallRequest):
    """Create an outbound Vapi call. Returns immediately; call progresses async."""
    call_id = str(uuid.uuid4())
    scenario = Scenario(type=body.scenario_type, details=body.scenario_details)

    call_data = CallData(
        call_id=call_id,
        phone_number=body.phone_number,
        scenario=scenario,
    )
    active_calls[call_id] = call_data

    try:
        result = await get_vapi().initiate_call(
            to_number=body.phone_number,
            system_prompt=scenario.get_system_prompt(),
            first_message=scenario.get_opening_message(),
        )
        call_data.vapi_call_id = result["id"]
        call_data.set_status(_map_vapi_status(result))
        logger.info("Call %s initiated (Vapi ID: %s)", call_id, result["id"])
    except Exception as exc:
        active_calls.pop(call_id, None)
        logger.error("Failed to initiate call: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))

    return CallResponse(
        call_id=call_id,
        status=call_data.status,
        message=f"Outbound call initiated to {body.phone_number}",
    )


@router.get("/status/{call_id}")
async def get_call_status(call_id: str) -> Dict[str, Any]:
    """Return current status and transcript, refreshed from Vapi on each poll."""
    call_data = active_calls.get(call_id)
    if not call_data:
        raise HTTPException(status_code=404, detail="Call not found")

    if call_data.vapi_call_id:
        try:
            vapi_data = await get_vapi().get_call(call_data.vapi_call_id)
            if vapi_data:
                call_data.set_status(_map_vapi_status(vapi_data))
                call_data.transcript = _extract_transcript(vapi_data)
        except Exception as exc:
            logger.warning("Could not refresh Vapi status for %s: %s", call_id, exc)

    return call_data.to_dict()


@router.get("/active")
async def list_active_calls() -> Dict[str, Any]:
    """Return a summary of all calls currently in memory."""
    return {
        "count": len(active_calls),
        "calls": [
            {
                "call_id": c.call_id,
                "phone_number": c.phone_number,
                "status": c.status,
                "scenario_type": c.scenario.type,
            }
            for c in active_calls.values()
        ],
    }


@router.post("/{call_id}/end", status_code=200)
async def end_call(call_id: str) -> Dict[str, str]:
    """Hang up a live call."""
    call_data = active_calls.get(call_id)
    if not call_data:
        raise HTTPException(status_code=404, detail="Call not found")

    if call_data.vapi_call_id:
        try:
            await get_vapi().end_call(call_data.vapi_call_id)
        except Exception as exc:
            logger.warning("Vapi end_call error: %s", exc)

    call_data.set_status(CallStatus.COMPLETED)
    return {"message": "Call terminated"}
