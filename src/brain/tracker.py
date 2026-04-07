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


# ---------------------------------------------------------------------------
# Assumptions
# ---------------------------------------------------------------------------

def get_assumptions_display(status: str | None = None) -> list[dict]:
    assumptions = store.get_assumptions(status=status)
    display = []
    for a in assumptions:
        display.append({
            "id": a["id"],
            "assumption": a["assumption"],
            "category": a.get("category", "general"),
            "status": a.get("status", "untested"),
            "evidence": a.get("evidence"),
            "tested_at": a.get("tested_at"),
            "date": a.get("created_at", "unknown"),
        })
    return display


def confirm_assumption(assumption_id: int, evidence: str):
    store.update_assumption_status(assumption_id, "confirmed", evidence)


def bust_assumption(assumption_id: int, evidence: str):
    store.update_assumption_status(assumption_id, "busted", evidence)


def get_stale_assumptions_display(days: int = 30) -> list[dict]:
    stale = store.get_stale_assumptions(days=days)
    display = []
    for a in stale:
        display.append({
            "id": a["id"],
            "assumption": a["assumption"],
            "category": a.get("category", "general"),
            "date": a.get("created_at", "unknown"),
        })
    return display
