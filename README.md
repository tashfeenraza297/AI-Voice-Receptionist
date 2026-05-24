# Voice AI Agent

An outbound voice AI agent that conducts natural, real-time conversations directly in the browser. Supports two campaign scenarios — **Appointment Reminder** and **Lead Qualification** — powered by a full STT → LLM → TTS pipeline orchestrated by [Vapi](https://vapi.ai).

Built as part of a technical assessment. The agent handles real conversations, maintains context across turns, and gracefully resolves each scenario (confirm / reschedule / cancel for appointments; qualify and offer a demo for leads).

---

## Live Demo Flow

1. Open the web app at `http://localhost:8000`
2. Select a campaign scenario and fill in the details
3. Click **Initiate Call** — allow microphone access
4. The AI agent speaks first and conducts the full conversation
5. Watch the real-time transcript update as the conversation unfolds
6. The agent closes the call naturally, or click **End Call** at any time

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  Browser (UI)                     │
│                                                   │
│  Campaign form → POST /api/calls/web-config       │
│       ↓ receives assistant config + public key    │
│  Vapi Web SDK (WebRTC) ←──────────────────────┐  │
└────────────────────────────────────────────────┼──┘
                                                 │ WebRTC audio
                                                 ▼
┌──────────────────────────────────────────────────┐
│                   Vapi Platform                   │
│                                                   │
│   Deepgram Nova-2  →  GPT-3.5-turbo  →  OpenAI   │
│   (STT)               (LLM)            TTS Nova   │
└──────────────────────────────────────────────────┘
                         ↑
┌──────────────────────────────────────────────────┐
│               FastAPI Backend                     │
│                                                   │
│  POST /api/calls/web-config                       │
│    → builds assistant config from scenario        │
│    → returns config + Vapi public key             │
│                                                   │
│  POST /webhooks/vapi-events  (optional push)      │
└──────────────────────────────────────────────────┘
```

### How the pipeline works per call

```
Your voice (browser mic)
  → Vapi WebRTC → Deepgram Nova-2 STT (real-time transcription)
                          ↓ (final transcript)
                   GPT-3.5-turbo (full conversation history)
                          ↓ (text reply, max 150 tokens)
                   OpenAI TTS "nova" voice
                          ↓ (audio stream)
  You hear ← Vapi WebRTC ←────────────────────────
```

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Voice AI Platform | [Vapi](https://vapi.ai) | Orchestrates telephony, STT, LLM, TTS in one API |
| STT | Deepgram Nova-2 (via Vapi) | Real-time speech-to-text |
| LLM | GPT-3.5-turbo (via Vapi) | Conversation intelligence |
| TTS | OpenAI TTS — "nova" (via Vapi) | Natural voice synthesis |
| Backend | FastAPI + Python | Scenario config, REST API |
| Frontend | Vanilla JS + Vapi Web SDK | Browser WebRTC call interface |

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, static file serving
│   │   ├── config.py            # Pydantic settings (reads .env)
│   │   ├── routers/
│   │   │   ├── calls.py         # REST: web-config, status, end
│   │   │   └── webhooks.py      # Vapi event webhook handler
│   │   ├── services/
│   │   │   ├── call_manager.py  # In-memory call registry (CallData)
│   │   │   └── vapi_service.py  # Vapi REST API client
│   │   └── models/
│   │       ├── call.py          # Pydantic request/response models
│   │       └── scenario.py      # Scenario types + system prompt builders
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html               # Single-page UI
│   └── static/
│       ├── styles.css           # Glassmorphism design system
│       └── app.js               # Vapi Web SDK integration
├── .gitignore
└── README.md
```

---

## Setup

### 1. Prerequisites

- Python 3.10+
- A [Vapi account](https://vapi.ai) — sign up free, $10 credit included (no credit card needed)

### 2. Get Vapi credentials

1. Go to [dashboard.vapi.ai](https://dashboard.vapi.ai)
2. **Private Key** → Account → copy your Private API key
3. **Public Key** → Account → copy your Public API key

### 3. Clone and install

```bash
git clone <repo-url>
cd DeveloperDen/backend

python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
VAPI_PRIVATE_KEY=your_private_key_here
VAPI_PUBLIC_KEY=your_public_key_here
VAPI_PHONE_NUMBER_ID=your_phone_number_id_here
```

### 5. Run

```bash
# From the backend/ directory
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Open **http://localhost:8000** — no ngrok required.

---

## Scenarios

### Appointment Reminder
**AI Persona:** Alex, patient coordinator

**Conversation flow:**
1. Confirm speaking with the right patient
2. Remind about appointment (date, time, doctor, department)
3. Ask to confirm, reschedule, or cancel
4. Handle the response naturally and close the call

**Example details to test with:**
- Patient: John Smith | Doctor: Dr. Sarah Johnson | Cardiology | May 30, 2026 at 10:00 AM

---

### Lead Qualification
**AI Persona:** Jordan, sales development representative

**Conversation flow:**
1. Confirm speaking with the right lead
2. Introduce purpose of the call
3. Ask qualifying questions (timeline, budget, pain points)
4. Offer a product demo if interest confirmed
5. Close gracefully regardless of outcome

**Example details to test with:**
- Lead: Sarah Johnson | Product: AI customer support chatbot | TechVision Inc

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/calls/web-config` | Returns Vapi assistant config + public key for browser SDK |
| `POST` | `/api/calls/initiate` | Initiate an outbound phone call (requires Vapi paid plan) |
| `GET` | `/api/calls/status/{call_id}` | Poll call status and transcript |
| `GET` | `/api/calls/active` | List all calls in memory |
| `POST` | `/api/calls/{call_id}/end` | End an active call |
| `POST` | `/webhooks/vapi-events` | Vapi real-time event webhook |
| `GET` | `/health` | Health check |

Interactive API docs: **http://localhost:8000/docs**

---

## Evolution of the Stack — Why We Moved to Vapi

The system was originally architected with four separate best-in-class services:

| Layer | Original Choice | Reason |
|---|---|---|
| Telephony | Twilio | Industry standard, outbound call API, Media Streams WebSocket |
| STT | Deepgram Nova-2 | Low-latency streaming, native µ-law 8 kHz input |
| LLM | Groq — Llama 3.3-70b | Free tier, ultra-low latency inference |
| TTS | ElevenLabs Turbo v2.5 | Natural voice, native `ulaw_8000` output (no codec conversion) |

The original pipeline worked as follows:
1. FastAPI initiated an outbound call via Twilio REST API
2. Twilio fetched a TwiML webhook and opened a bidirectional Media Stream WebSocket
3. µ-law audio streamed in real-time to Deepgram for transcription
4. Final transcripts triggered Groq for a response
5. ElevenLabs synthesized the reply and streamed audio back through the WebSocket to Twilio

**Why we switched to Vapi:**

1. **Geo restriction** — Twilio's free trial blocks outbound calls to Pakistan (+92) as a "High-Risk" destination, requiring a paid upgrade. This made local testing impossible without incurring costs.

2. **Complexity vs. value** — Managing a real-time WebSocket pipeline across four separate APIs (Twilio Media Streams + Deepgram live transcription + Groq + ElevenLabs streaming) introduced significant integration complexity: codec compatibility, barge-in handling, stream lifecycle management. Vapi abstracts all of this behind a single API call.

3. **WebRTC over PSTN** — Vapi's Web SDK enables direct browser-to-AI calls over WebRTC, which has no geographic restrictions, zero telephony cost, and lower latency than routing through a PSTN bridge. For a demo, it also lets the full conversation be observed in real time.

4. **Same pipeline, less infrastructure** — Vapi internally uses Deepgram Nova-2 for STT, GPT-3.5-turbo for LLM, and OpenAI TTS for voice — the same quality tier as the original stack. The difference is that Vapi manages the real-time audio pipeline, not our server.

The backend retains the original `VapiService` class pattern (mirrors the old `TwilioService`) and the scenario/system-prompt architecture is unchanged — only the transport layer was swapped.

---

## Design Decisions

### Why Vapi instead of building a custom pipeline?

Vapi handles the entire voice AI stack (telephony + STT + LLM + TTS) in a single platform, eliminating the need to manage WebSocket connections, audio codec conversion (µ-law 8 kHz), and real-time streaming across three separate APIs. This dramatically reduces infrastructure complexity while still exposing full control over the assistant behavior via the inline assistant config.

The tradeoff is vendor dependency — but for a production deployment, Vapi also supports **bring-your-own-keys** for Deepgram, OpenAI, and ElevenLabs, so you can switch providers without changing application code.

### Why Vapi Web SDK (WebRTC) over PSTN phone calls?

PSTN calls require a purchased phone number with geographic coverage matching the destination country. WebRTC calls go directly through the browser over the internet with no geographic restrictions, zero additional cost, and no latency penalty from PSTN bridges. For a demo, WebRTC also lets the conversation be heard and observed in real time.

### Why FastAPI for the backend?

FastAPI's async-first design, automatic OpenAPI docs, and Pydantic validation make it a natural fit for AI applications that mix REST endpoints with real-time processing. The async HTTP client (httpx) used by VapiService integrates cleanly without blocking threads.

### Conversation context management

The full conversation history (system prompt + all turns) is sent to GPT-3.5-turbo on every turn. `maxTokens=150` keeps responses short and voice-appropriate — long responses feel unnatural in spoken conversation.

### In-memory call state

Call state lives in a Python dict keyed by a UUID `call_id`. This is intentionally simple for a single-process deployment. For production with multiple workers, replace with Redis.

---

## Requirements

```
fastapi==0.115.5
uvicorn[standard]==0.32.1
pydantic==2.10.3
pydantic-settings==2.6.1
python-multipart==0.0.20
httpx==0.28.1
python-dotenv==1.0.1
```
