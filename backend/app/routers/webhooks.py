"""
Webhook router — /webhooks/*

Vapi can POST real-time events here (optional — the /api/calls/status
endpoint already polls Vapi on demand, so these webhooks are a bonus).

Configure in Vapi dashboard → Phone Numbers → your number → Server URL:
  https://<your-public-url>/webhooks/vapi-events

Supported event types handled here:
  call-started   → IN_PROGRESS
  call-ended     → COMPLETED (or BUSY / NO_ANSWER based on endedReason)
  call-failed    → FAILED
"""
import logging

from fastapi import APIRouter, Request, Response

from ..models.call import CallStatus
from ..services.call_manager import active_calls

router = APIRouter()
logger = logging.getLogger(__name__)

_ENDED_REASON_MAP = {
    "busy":      CallStatus.BUSY,
    "no-answer": CallStatus.NO_ANSWER,
    "voicemail": CallStatus.NO_ANSWER,
    "failed":    CallStatus.FAILED,
}


@router.post("/vapi-events")
async def vapi_events(request: Request):
    """Receive Vapi server-sent events and update in-memory call state."""
    try:
        data = await request.json()
    except Exception:
        return Response(status_code=400)

    event_type: str = data.get("message", {}).get("type", "") or data.get("type", "")
    call_obj = data.get("message", {}).get("call") or data.get("call") or {}
    vapi_id: str = call_obj.get("id", "")

    if not vapi_id:
        return Response(status_code=204)

    # Find the matching CallData by Vapi call ID
    call_data = next(
        (c for c in active_calls.values() if c.vapi_call_id == vapi_id), None
    )
    if not call_data:
        return Response(status_code=204)

    if event_type == "call-started":
        call_data.set_status(CallStatus.IN_PROGRESS)
        logger.info("Vapi event: call-started for %s", call_data.call_id)

    elif event_type in ("call-ended", "end-of-call-report"):
        reason = call_obj.get("endedReason", "")
        status = _ENDED_REASON_MAP.get(reason, CallStatus.COMPLETED)
        call_data.set_status(status)
        logger.info(
            "Vapi event: call-ended for %s (reason=%s → %s)",
            call_data.call_id, reason, status,
        )

    elif event_type == "call-failed":
        call_data.set_status(CallStatus.FAILED)
        logger.info("Vapi event: call-failed for %s", call_data.call_id)

    return Response(status_code=204)
