"""
API routes for the CoFounder AI web interface.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from src.brain import session as session_mgr, knowledge, tracker
from src.llm import client, chains
from src.memory import store

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class StartSessionRequest(BaseModel):
    session_type: str = "general"

class StartSessionResponse(BaseModel):
    session_id: int
    opening_message: Optional[str] = None

class MessageRequest(BaseModel):
    session_id: int
    message: str
    session_type: str = "general"

class MessageResponse(BaseModel):
    response: str
    model_used: str

class EndSessionResponse(BaseModel):
    summary: Optional[str] = None

class ContextUpdateRequest(BaseModel):
    field: str
    value: str

class OnboardingMessageRequest(BaseModel):
    session_id: int
    message: str


# ---------------------------------------------------------------------------
# Session endpoints
# ---------------------------------------------------------------------------

@router.post("/session/start", response_model=StartSessionResponse)
def start_session(req: StartSessionRequest):
    session_id = session_mgr.start_session(req.session_type)
    opening = _get_opening(req.session_type)
    if opening:
        store.add_message(session_id, "assistant", opening)
    return StartSessionResponse(session_id=session_id, opening_message=opening)


@router.post("/session/message", response_model=MessageResponse)
def send_message(req: MessageRequest):
    response_text, model_used = session_mgr.process_message(
        req.session_id, req.message, req.session_type
    )
    return MessageResponse(response=response_text, model_used=model_used)


@router.post("/session/{session_id}/end", response_model=EndSessionResponse)
def end_session(session_id: int):
    summary = session_mgr.end_session(session_id)
    return EndSessionResponse(summary=summary)


# ---------------------------------------------------------------------------
# Onboarding
# ---------------------------------------------------------------------------

@router.post("/onboard/start", response_model=StartSessionResponse)
def start_onboarding():
    session_id = session_mgr.start_session("onboarding")
    opening = "Let's start. Tell me — what are you building, and why does it matter to you?"
    store.add_message(session_id, "assistant", opening)
    return StartSessionResponse(session_id=session_id, opening_message=opening)


@router.post("/onboard/message", response_model=MessageResponse)
def onboard_message(req: OnboardingMessageRequest):
    store.add_message(req.session_id, "user", req.message)
    all_msgs = session_mgr.build_prompt(req.session_id, req.message, "onboarding")
    response_text, model_used = client.think(all_msgs)
    store.add_message(req.session_id, "assistant", response_text)

    if "ONBOARDING_COMPLETE" in response_text:
        messages = store.get_messages(req.session_id)
        chains.extract_onboarding(messages)
        session_mgr.end_session(req.session_id)
        response_text = response_text.replace("ONBOARDING_COMPLETE", "").strip()

    return MessageResponse(response=response_text, model_used=model_used)


@router.get("/onboard/status")
def onboard_status():
    return {"onboarded": store.has_onboarded()}


# ---------------------------------------------------------------------------
# Startup context
# ---------------------------------------------------------------------------

@router.get("/startup/context")
def get_context():
    return {
        "context": knowledge.get_startup_snapshot(),
        "health": knowledge.get_health_indicators(),
    }


@router.post("/startup/context")
def update_context(req: ContextUpdateRequest):
    store.set_context(req.field, req.value)
    return {"status": "updated", "field": req.field, "value": req.value}


# ---------------------------------------------------------------------------
# Decisions & commitments
# ---------------------------------------------------------------------------

@router.get("/decisions")
def get_decisions(status: Optional[str] = "active"):
    return {"decisions": tracker.get_decisions_display(status=status)}


@router.get("/commitments")
def get_commitments(status: Optional[str] = "open"):
    return {"commitments": tracker.get_commitments_display(status=status)}


@router.post("/commitments/{commitment_id}/done")
def mark_done(commitment_id: int):
    tracker.mark_commitment_done(commitment_id)
    return {"status": "done"}


@router.post("/commitments/{commitment_id}/drop")
def mark_dropped(commitment_id: int):
    tracker.mark_commitment_dropped(commitment_id)
    return {"status": "dropped"}


@router.post("/decisions/{decision_id}/reverse")
def reverse_decision(decision_id: int):
    tracker.reverse_decision(decision_id)
    return {"status": "reversed"}


# ---------------------------------------------------------------------------
# Contradictions
# ---------------------------------------------------------------------------

@router.get("/contradictions")
def get_contradictions():
    return {"contradictions": store.get_contradictions(resolved=False)}


# ---------------------------------------------------------------------------
# Assumptions (Assumption Graveyard)
# ---------------------------------------------------------------------------

class UpdateAssumptionRequest(BaseModel):
    status: str
    evidence: Optional[str] = None


@router.get("/assumptions")
def get_assumptions(status: Optional[str] = None):
    return {"assumptions": tracker.get_assumptions_display(status=status)}


@router.get("/assumptions/stale")
def get_stale_assumptions(days: int = 30):
    return {"assumptions": tracker.get_stale_assumptions_display(days=days)}


@router.post("/assumptions/{assumption_id}/confirm")
def confirm_assumption(assumption_id: int, req: UpdateAssumptionRequest):
    tracker.confirm_assumption(assumption_id, req.evidence or "")
    return {"status": "confirmed"}


@router.post("/assumptions/{assumption_id}/bust")
def bust_assumption(assumption_id: int, req: UpdateAssumptionRequest):
    tracker.bust_assumption(assumption_id, req.evidence or "")
    return {"status": "busted"}


# ---------------------------------------------------------------------------
# Monday Morning Briefing
# ---------------------------------------------------------------------------

@router.get("/briefing")
def get_briefing():
    return knowledge.generate_briefing()


# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------

@router.get("/usage")
def get_usage():
    return {
        "usage": client.get_daily_usage(),
        "limits": {
            "gpt-4o": client.DAILY_STRONG_LIMIT,
            "gpt-4o-mini": client.DAILY_FAST_LIMIT,
        },
    }


# ---------------------------------------------------------------------------
# Sessions history
# ---------------------------------------------------------------------------

@router.get("/sessions")
def get_sessions(limit: int = 10):
    return {"sessions": store.get_recent_sessions(limit=limit)}


@router.get("/sessions/{session_id}/messages")
def get_session_messages(session_id: int):
    return {"messages": store.get_messages(session_id)}


# ---------------------------------------------------------------------------
# WebSocket for streaming (optional enhancement)
# ---------------------------------------------------------------------------

@router.websocket("/ws/session/{session_id}")
async def websocket_session(websocket: WebSocket, session_id: int):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "")
            session_type = data.get("session_type", "general")

            if not message:
                await websocket.send_json({"error": "Empty message"})
                continue

            response_text, model_used = session_mgr.process_message(
                session_id, message, session_type
            )

            await websocket.send_json({
                "response": response_text,
                "model_used": model_used,
            })
    except WebSocketDisconnect:
        session_mgr.end_session(session_id)


# ---------------------------------------------------------------------------
# Voice / Phone Call (Vapi.ai webhook)
# ---------------------------------------------------------------------------

_voice_sessions: dict = {}


@router.post("/voice/call-start")
def voice_call_start(payload: dict):
    """Vapi calls this when a phone call starts."""
    call_id = payload.get("call", {}).get("id", "unknown")
    session_id = session_mgr.start_session("phone_call")
    _voice_sessions[call_id] = session_id
    opening = "Hey, your co-founder here. What's on your mind?"
    store.add_message(session_id, "assistant", opening)
    return {"message": opening}


@router.post("/voice/message")
def voice_message(payload: dict):
    """
    Vapi webhook: receives transcribed speech, returns AI response.
    Also works as a generic voice endpoint for browser-based calls.
    """
    call_id = payload.get("call_id", "browser")
    user_message = payload.get("message", "")

    if not user_message:
        return {"response": "I didn't catch that. Can you say it again?"}

    session_id = _voice_sessions.get(call_id)
    if not session_id:
        session_id = session_mgr.start_session("voice")
        _voice_sessions[call_id] = session_id
        opening = "Voice session started. What's on your mind?"
        store.add_message(session_id, "assistant", opening)

    response_text, model_used = session_mgr.process_message(
        session_id, user_message, "general"
    )
    return {
        "response": response_text,
        "session_id": session_id,
        "model_used": model_used,
    }


@router.post("/voice/call-end")
def voice_call_end(payload: dict):
    """Vapi calls this when a phone call ends."""
    call_id = payload.get("call", {}).get("id", "unknown")
    session_id = _voice_sessions.pop(call_id, None)
    if session_id:
        summary = session_mgr.end_session(session_id)
        return {"summary": summary, "session_id": session_id}
    return {"status": "no session found"}


@router.post("/voice/browser-start")
def browser_voice_start():
    """Start a voice session from the browser call UI."""
    session_id = session_mgr.start_session("voice")
    call_id = f"browser_{session_id}"
    _voice_sessions[call_id] = session_id
    opening = "Hey, I'm here. What do you want to talk about?"
    store.add_message(session_id, "assistant", opening)
    return {
        "session_id": session_id,
        "call_id": call_id,
        "opening_message": opening,
    }


@router.post("/voice/browser-end")
def browser_voice_end(payload: dict):
    """End a browser voice session."""
    call_id = payload.get("call_id", "")
    session_id = _voice_sessions.pop(call_id, None)
    if not session_id:
        session_id = payload.get("session_id")
    if session_id:
        summary = session_mgr.end_session(session_id)
        return {"summary": summary}
    return {"summary": None}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_opening(session_type: str) -> Optional[str]:
    openings = {
        "strategy": "Strategy session. What's on your mind? What strategic question are you wrestling with?",
        "decision": "Decision time. What decision are you trying to make? Walk me through the options you're considering.",
        "quick": "Quick question mode. What do you need?",
        "checkin": None,
        "general": "What are you thinking about today?",
    }
    return openings.get(session_type, "What are you thinking about today?")
