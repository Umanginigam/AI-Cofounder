"""
Post-session extraction pipeline.

After a session (or every N messages), uses gpt-4o-mini to extract:
- New facts about the startup
- Decisions made (with rationale)
- Commitments (things the founder said they'd do)
- Strategy changes
- Contradictions with existing stored context
"""

from __future__ import annotations

import json
import hashlib
from typing import Any

from src.llm.client import extract
from src.memory import store, vectors

EXTRACTION_PROMPT = """\
You are analyzing a conversation between a founder and their AI co-founder.

Here is the existing startup context:
{existing_context}

Here is the conversation to analyze:
{conversation}

Extract the following as a JSON object. Be precise — only include things explicitly stated or clearly implied:

{{
  "facts": [
    {{"field": "problem|icp|value_prop|model|stage|competitors|risk|other", "value": "the fact"}}
  ],
  "decisions": [
    {{"decision": "what was decided", "rationale": "why", "confidence": "high|medium|low"}}
  ],
  "commitments": [
    {{"commitment": "what the founder committed to do", "deadline": "when, or null"}}
  ],
  "contradictions": [
    {{"old_statement": "what was previously believed/stated", "new_statement": "what contradicts it"}}
  ]
}}

Rules:
- Only extract facts that are NEW or CHANGED from the existing context.
- Only extract decisions that were actually MADE, not just discussed.
- Commitments must be specific actions the founder said they WILL do.
- Contradictions are things that conflict with the existing startup context above.
- Return valid JSON only. If a category is empty, use an empty array.
"""


def extract_from_conversation(
    session_id: int,
    messages: list[dict[str, str]],
) -> dict[str, Any]:
    """
    Run the extraction pipeline on a conversation.

    Returns the extracted data dict and persists everything to the database + vector store.
    """
    existing_context = store.get_all_context_formatted()

    conversation_text = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in messages
    )

    prompt = EXTRACTION_PROMPT.format(
        existing_context=existing_context,
        conversation=conversation_text,
    )

    raw = extract([
        {"role": "system", "content": "You extract structured data from conversations. Return valid JSON only."},
        {"role": "user", "content": prompt},
    ])

    try:
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            raw = raw.rsplit("```", 1)[0]
        data = json.loads(raw)
    except (json.JSONDecodeError, IndexError):
        return {"facts": [], "decisions": [], "commitments": [], "contradictions": []}

    for fact in data.get("facts", []):
        store.set_context(fact["field"], fact["value"])

    for dec in data.get("decisions", []):
        dec_id = store.add_decision(
            session_id=session_id,
            decision=dec["decision"],
            rationale=dec.get("rationale", ""),
            confidence=dec.get("confidence", "medium"),
        )
        vectors.add_decision_memory(
            session_id=session_id,
            decision_id=dec_id,
            text=f"Decision: {dec['decision']}. Rationale: {dec.get('rationale', 'none')}",
        )

    for com in data.get("commitments", []):
        com_id = store.add_commitment(
            session_id=session_id,
            commitment=com["commitment"],
            deadline=com.get("deadline"),
        )
        vectors.add_commitment_memory(
            session_id=session_id,
            commitment_id=com_id,
            text=f"Commitment: {com['commitment']}",
        )

    for contradiction in data.get("contradictions", []):
        store.add_contradiction(
            old_statement=contradiction["old_statement"],
            new_statement=contradiction["new_statement"],
            new_session_id=session_id,
        )

    return data


def extract_session_summary(session_id: int, messages: list[dict[str, str]]) -> str:
    """Generate and store a session summary."""
    conversation_text = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in messages
    )

    raw = extract([
        {"role": "system", "content": "Summarize this founder/co-founder session in 2-3 sentences. Focus on what was discussed, what was decided, and any open questions."},
        {"role": "user", "content": conversation_text},
    ])

    summary = raw.strip()
    store.end_session(session_id, summary=summary)
    vectors.add_session_summary(session_id, summary)
    return summary
