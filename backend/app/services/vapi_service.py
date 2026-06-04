"""
Vapi API client — wraps the three operations needed for outbound calls.

Vapi is an all-in-one Voice AI platform: it handles telephony, STT (Deepgram),
LLM (GPT-3.5-turbo), and TTS (OpenAI / ElevenLabs) from a single API call.
No separate Twilio WebSocket or audio pipeline management is needed.
"""
import logging
from typing import Any, Dict

import httpx

logger = logging.getLogger(__name__)

_VAPI_BASE = "https://api.vapi.ai"


class VapiService:
    def __init__(self, private_key: str, phone_number_id: str) -> None:
        self._phone_number_id = phone_number_id
        self._headers = {
            "Authorization": f"Bearer {private_key}",
            "Content-Type": "application/json",
        }

    async def initiate_call(
        self,
        to_number: str,
        system_prompt: str,
        first_message: str,
    ) -> Dict[str, Any]:
        """
        POST /call/phone — kick off an outbound call.
        Returns the Vapi call object (contains 'id' and initial 'status').
        """
        payload = {
            "phoneNumberId": self._phone_number_id,
            "customer": {"number": to_number},
            "assistant": {
                "model": {
                    "provider": "openai",
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "system", "content": system_prompt}],
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
                },
                "firstMessage": first_message,
                "endCallMessage": "Goodbye, have a great day!",
                "backgroundDenoisingEnabled": True,
                "recordingEnabled": False,
            },
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_VAPI_BASE}/call/phone",
                headers=self._headers,
                json=payload,
            )
            if resp.status_code not in (200, 201):
                raise RuntimeError(f"Vapi {resp.status_code}: {resp.text}")
            return resp.json()

    async def get_call(self, vapi_call_id: str) -> Dict[str, Any]:
        """GET /call/{id} — poll call status and transcript."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{_VAPI_BASE}/call/{vapi_call_id}",
                headers=self._headers,
            )
            if resp.status_code == 404:
                return {}
            resp.raise_for_status()
            return resp.json()

    async def end_call(self, vapi_call_id: str) -> None:
        """DELETE /call/{id} — hang up a live call."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.delete(
                f"{_VAPI_BASE}/call/{vapi_call_id}",
                headers=self._headers,
            )
            if resp.status_code not in (200, 204):
                logger.warning("Vapi end_call %s: %s", vapi_call_id, resp.status_code)
