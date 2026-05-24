from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class CallStatus(str, Enum):
    INITIATED = "initiated"
    RINGING = "ringing"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    NO_ANSWER = "no_answer"
    BUSY = "busy"


class TranscriptEntry(BaseModel):
    role: str  # "user" | "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class InitiateCallRequest(BaseModel):
    phone_number: str = Field(..., description="E.164 format, e.g. +12345678900")
    scenario_type: str = Field(..., description="Scenario identifier")
    scenario_details: Dict[str, Any] = Field(..., description="Scenario-specific fields")


class CallResponse(BaseModel):
    call_id: str
    status: CallStatus
    message: str


class CallStatusResponse(BaseModel):
    call_id: str
    phone_number: str
    status: CallStatus
    scenario_type: str
    duration_seconds: Optional[int] = None
    transcript: List[Dict[str, str]] = []
    outcome: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ActiveCallsResponse(BaseModel):
    count: int
    calls: List[Dict[str, Any]]
