"""
Call Manager — lightweight in-memory call registry.

With Vapi, there is no local audio pipeline to manage. This module only
stores call metadata so the REST endpoints can track and return status.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..models.call import CallStatus
from ..models.scenario import Scenario

# Global call registry — keyed by our internal call_id (UUID string)
active_calls: Dict[str, "CallData"] = {}


class CallData:
    __slots__ = (
        "call_id", "phone_number", "scenario", "status",
        "vapi_call_id", "transcript", "created_at", "updated_at",
    )

    def __init__(self, call_id: str, phone_number: str, scenario: Scenario) -> None:
        self.call_id = call_id
        self.phone_number = phone_number
        self.scenario = scenario
        self.status: CallStatus = CallStatus.INITIATED
        self.vapi_call_id: Optional[str] = None
        self.transcript: List[Dict[str, str]] = []
        self.created_at: datetime = datetime.utcnow()
        self.updated_at: datetime = datetime.utcnow()

    def set_status(self, status: CallStatus) -> None:
        self.status = status
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "call_id": self.call_id,
            "phone_number": self.phone_number,
            "status": self.status,
            "scenario_type": self.scenario.type,
            "transcript": self.transcript,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
