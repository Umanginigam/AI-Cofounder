"""
Session lifecycle management.

Handles starting sessions, building prompts, running the conversation loop,
and triggering post-session extraction.
"""

from __future__ import annotations

from src.llm import client, prompts
from src.memory import store
from src.memory.retriever import get_relevant_context
from src.memory.extractor import extract_from_conversation, extract_session_summary
from src.brain.pushback import analyze, get_pushback_prompt_modifier, PushbackType


MESSAGE_BATCH_SIZE = 5  # run extraction every N messages


def start_session(session_type: str = "general") -> int:
    return store.create_session(session_type)


def build_prompt(
    session_id: int,
    user_message: str,
    session_type: str = "general",
) -> list[dict[str, str]]:
    """
    Build the full message list for the LLM call.

    1. Base system prompt
    2. Context block (startup data + relevant memories)
    3. Pushback modifier (if applicable)
    4. Conversation history
    5. Current user message
    """
    if session_type == "onboarding":
        system = prompts.ONBOARDING_SYSTEM
    elif session_type == "checkin":
        system = prompts.BASE_SYSTEM + "\n\n" + prompts.CHECKIN_SYSTEM
    else:
        system = prompts.BASE_SYSTEM

    if session_type != "onboarding" and store.has_onboarded():
        context_block = get_relevant_context(user_message, session_id)
        system += "\n\n" + context_block

        pb_type, pb_detail = analyze(user_message)
        if pb_type != PushbackType.NORMAL:
            modifier = get_pushback_prompt_modifier(pb_type, pb_detail)
            if modifier:
                system += "\n\n" + modifier

    messages: list[dict[str, str]] = [{"role": "system", "content": system}]

    history = store.get_recent_messages(session_id, limit=20)
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})

    return messages


def process_message(
    session_id: int,
    user_message: str,
    session_type: str = "general",
) -> tuple[str, str]:
    """
    Process a user message: build prompt, call LLM, store messages, trigger extraction.

    Returns (assistant_response, model_used).
    """
    store.add_message(session_id, "user", user_message)

    full_messages = build_prompt(session_id, user_message, session_type)

    response_text, model_used = client.think(full_messages)

    store.add_message(session_id, "assistant", response_text)

    all_messages = store.get_messages(session_id)
    msg_count = len([m for m in all_messages if m["role"] == "user"])
    if msg_count > 0 and msg_count % MESSAGE_BATCH_SIZE == 0:
        try:
            extract_from_conversation(session_id, all_messages)
        except Exception:
            pass

    return response_text, model_used


def end_session(session_id: int) -> str | None:
    """
    End a session: run final extraction and generate summary.
    Returns the session summary.
    """
    messages = store.get_messages(session_id)
    if not messages:
        store.end_session(session_id)
        return None

    try:
        extract_from_conversation(session_id, messages)
    except Exception:
        pass

    try:
        summary = extract_session_summary(session_id, messages)
        return summary
    except Exception:
        store.end_session(session_id)
        return None
