from pydantic import BaseModel
from typing import Any, Dict
from enum import Enum


class ScenarioType(str, Enum):
    APPOINTMENT_REMINDER = "appointment_reminder"
    LEAD_QUALIFICATION = "lead_qualification"


# ---------------------------------------------------------------------------
# System-prompt builders
# ---------------------------------------------------------------------------

_APPOINTMENT_SYSTEM = """You are Alex, a friendly patient coordinator at {clinic_name}.
You are making an outbound call to remind a patient about their upcoming appointment.

Appointment Details:
- Patient Name: {patient_name}
- Date: {appointment_date}
- Time: {appointment_time}
- Doctor: {doctor_name}
- Department: {department}

Your goals (follow this order):
1. Confirm you are speaking with {patient_name}.
2. Remind them about the appointment details.
3. Ask whether they will attend, need to reschedule, or want to cancel.
4. Handle their response naturally and wrap up the call.

Rules:
- Be warm, professional, and concise — maximum 2 short sentences per turn.
- If they confirm: thank them and mention bringing their insurance card.
- If they want to reschedule: acknowledge and say the office will call back to arrange a new time.
- If they want to cancel: acknowledge and ask if they'd like to reschedule in the future.
- If they ask something you cannot answer: say the office will follow up.
- When the conversation is fully resolved, say a warm goodbye and end naturally.
- NEVER repeat appointment details the patient already acknowledged."""

_LEAD_SYSTEM = """You are Jordan, a friendly sales development representative at {company_name}.
You are calling {lead_name}, who recently expressed interest in {product_interest}.

Your goals (follow this order):
1. Confirm you are speaking with {lead_name}.
2. Briefly introduce yourself and the purpose of the call.
3. Ask 2-3 qualifying questions: timeline, budget range, current pain points.
4. If they seem interested, offer to schedule a short product demo.
5. Wrap up the call politely regardless of the outcome.

Rules:
- Be conversational, never pushy — maximum 2 short sentences per turn.
- Listen actively and tailor responses to what they say.
- If they are not interested: thank them for their time and end the call gracefully.
- When the conversation is fully resolved, say a warm goodbye and end naturally."""


class Scenario(BaseModel):
    type: ScenarioType
    details: Dict[str, Any]

    def get_system_prompt(self) -> str:
        d = self.details
        if self.type == ScenarioType.APPOINTMENT_REMINDER:
            return _APPOINTMENT_SYSTEM.format(
                clinic_name=d.get("clinic_name", "HealthFirst Medical Center"),
                patient_name=d.get("patient_name", "the patient"),
                appointment_date=d.get("appointment_date", "your scheduled date"),
                appointment_time=d.get("appointment_time", "your scheduled time"),
                doctor_name=d.get("doctor_name", "your doctor"),
                department=d.get("department", "General Medicine"),
            )
        if self.type == ScenarioType.LEAD_QUALIFICATION:
            return _LEAD_SYSTEM.format(
                company_name=d.get("company_name", "our company"),
                lead_name=d.get("lead_name", "the prospect"),
                product_interest=d.get("product_interest", "our solution"),
            )
        return "You are a professional AI agent making an outbound call. Be concise and helpful."

    def get_opening_message(self) -> str:
        d = self.details
        if self.type == ScenarioType.APPOINTMENT_REMINDER:
            return f"Hello, may I please speak with {d.get('patient_name', 'the patient')}?"
        if self.type == ScenarioType.LEAD_QUALIFICATION:
            return f"Hello, may I please speak with {d.get('lead_name', 'the lead')}?"
        return "Hello, is this a good time to talk?"
