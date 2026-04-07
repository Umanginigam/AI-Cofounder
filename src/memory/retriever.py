"""
Unified context retriever.

Combines structured SQL lookups (startup context, decisions, commitments)
with semantic vector search (past conversation memories) into a single
formatted context block for injection into the system prompt.
"""

from __future__ import annotations

from src.memory import store, vectors
from src.llm.prompts import CONTEXT_BLOCK


def get_relevant_context(query: str, session_id: int | None = None) -> str:
    """
    Build a full context block combining structured data and semantic memories.

    Args:
        query: The user's current message (used for semantic search).
        session_id: Current session id (to exclude from memory search).
    """
    context_str = store.get_all_context_formatted()

    decisions = store.get_decisions(status="active")
    if decisions:
        dec_lines = []
        for d in decisions[:10]:
            confidence = f" [{d['confidence']}]" if d.get("confidence") else ""
            dec_lines.append(f"- {d['decision']}{confidence} — {d.get('rationale', 'no rationale recorded')}")
        decisions_str = "\n".join(dec_lines)
    else:
        decisions_str = "No decisions recorded yet."

    commitments = store.get_commitments(status="open")
    if commitments:
        com_lines = []
        for c in commitments:
            deadline = f" (deadline: {c['deadline']})" if c.get("deadline") else ""
            com_lines.append(f"- {c['commitment']}{deadline}")
        commitments_str = "\n".join(com_lines)
    else:
        commitments_str = "No open commitments."

    try:
        memories = vectors.search_memory(query, n_results=5)
        if memories:
            mem_lines = []
            for m in memories:
                mem_type = m["metadata"].get("type", "unknown")
                mem_lines.append(f"[{mem_type}] {m['text']}")
            memories_str = "\n".join(mem_lines)
        else:
            memories_str = "No past conversation memories yet."
    except Exception:
        memories_str = "No past conversation memories yet."

    return CONTEXT_BLOCK.format(
        context=context_str,
        decisions=decisions_str,
        commitments=commitments_str,
        memories=memories_str,
    )


def get_open_commitments_formatted() -> str:
    """Get a formatted string of open commitments for pushback prompts."""
    commitments = store.get_commitments(status="open")
    if not commitments:
        return ""
    lines = []
    for c in commitments:
        deadline = f" (deadline: {c['deadline']})" if c.get("deadline") else ""
        lines.append(f"- {c['commitment']}{deadline} [set on {c.get('created_at', '?')}]")
    return "\n".join(lines)
