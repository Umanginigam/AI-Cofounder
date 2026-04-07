"""
Commitment and decision tracker.

Provides formatted views of decisions and commitments for CLI display.
"""

from __future__ import annotations

from src.memory import store


def get_decisions_display(status: str | None = "active") -> list[dict]:
    """Get decisions formatted for display."""
    decisions = store.get_decisions(status=status)
    display = []
    for d in decisions:
        display.append({
            "id": d["id"],
            "decision": d["decision"],
            "rationale": d.get("rationale", ""),
            "confidence": d.get("confidence", "medium"),
            "status": d.get("status", "active"),
            "date": d.get("created_at", "unknown"),
        })
    return display


def get_commitments_display(status: str | None = "open") -> list[dict]:
    """Get commitments formatted for display."""
    commitments = store.get_commitments(status=status)
    display = []
    for c in commitments:
        display.append({
            "id": c["id"],
            "commitment": c["commitment"],
            "deadline": c.get("deadline", "none"),
            "status": c.get("status", "open"),
            "date": c.get("created_at", "unknown"),
        })
    return display


def mark_commitment_done(commitment_id: int):
    store.update_commitment_status(commitment_id, "done")


def mark_commitment_dropped(commitment_id: int):
    store.update_commitment_status(commitment_id, "dropped")


def reverse_decision(decision_id: int):
    store.update_decision_status(decision_id, "reversed")
