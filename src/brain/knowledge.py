"""
Startup knowledge graph helpers.

Provides a high-level view of the startup's current state by assembling
structured data from the store into a readable snapshot.
Also generates the Monday Morning Briefing.
"""

from __future__ import annotations

from datetime import datetime, timezone

from src.memory import store
from src.llm import client


CONTEXT_FIELDS = {
    "problem": "Problem",
    "icp": "Target Customer (ICP)",
    "value_prop": "Value Proposition",
    "model": "Business Model",
    "stage": "Stage",
    "competitors": "Competitors",
    "risk": "Biggest Risk",
    "product": "Product Status",
    "revenue": "Revenue",
    "team": "Team",
}


def get_startup_snapshot() -> dict[str, str]:
    """Get a dict of all current startup context fields."""
    rows = store.get_context()
    snapshot = {}
    for r in rows:
        label = CONTEXT_FIELDS.get(r["field"], r["field"].replace("_", " ").title())
        snapshot[label] = r["value"]
    return snapshot


def get_startup_summary() -> str:
    """Get a human-readable summary of the startup."""
    snapshot = get_startup_snapshot()
    if not snapshot:
        return "No startup context recorded yet. Run `cofounder onboard` to get started."

    lines = []
    for label, value in snapshot.items():
        lines.append(f"  {label}: {value}")
    return "\n".join(lines)


def get_health_indicators() -> dict[str, str]:
    """
    Quick health check of the startup's tracked state.
    Returns indicators like missing context fields, stale decisions, overdue commitments.
    """
    indicators = {}

    context = store.get_context()
    filled = {r["field"] for r in context}
    core_fields = {"problem", "icp", "value_prop", "model", "stage"}
    missing = core_fields - filled
    if missing:
        indicators["missing_context"] = f"Missing: {', '.join(missing)}"
    else:
        indicators["context_completeness"] = "All core fields filled"

    open_commitments = store.get_commitments(status="open")
    indicators["open_commitments"] = str(len(open_commitments))

    active_decisions = store.get_decisions(status="active")
    indicators["active_decisions"] = str(len(active_decisions))

    unresolved = store.get_contradictions(resolved=False)
    if unresolved:
        indicators["unresolved_contradictions"] = str(len(unresolved))

    untested = store.get_assumptions(status="untested")
    indicators["untested_assumptions"] = str(len(untested))

    stale = store.get_stale_assumptions(days=30)
    if stale:
        indicators["stale_assumptions"] = str(len(stale))

    return indicators


# ---------------------------------------------------------------------------
# Monday Morning Briefing
# ---------------------------------------------------------------------------

BRIEFING_HARD_QUESTION_PROMPT = """\
You are an AI co-founder. Based on the following startup context, generate ONE hard \
question the founder should be asking themselves this week. Make it specific to their \
situation, uncomfortable, and important. No preamble — just the question.

Startup context:
{context}

Open commitments: {commitments_count}
Untested assumptions: {assumptions_count} ({stale_count} are 30+ days old)
Active decisions: {decisions_count}
"""


def generate_briefing() -> dict:
    """
    Generate the Monday Morning Briefing.
    Returns a dict with all briefing sections.
    """
    open_commitments = store.get_commitments(status="open")
    active_decisions = store.get_decisions(status="active")
    untested_assumptions = store.get_assumptions(status="untested")
    stale_assumptions = store.get_stale_assumptions(days=30)
    unresolved_contradictions = store.get_contradictions(resolved=False)
    context_formatted = store.get_all_context_formatted()

    hard_question = None
    try:
        prompt = BRIEFING_HARD_QUESTION_PROMPT.format(
            context=context_formatted,
            commitments_count=len(open_commitments),
            assumptions_count=len(untested_assumptions),
            stale_count=len(stale_assumptions),
            decisions_count=len(active_decisions),
        )
        hard_question, _ = client.think(
            [
                {"role": "system", "content": "Generate one hard question for a founder. Be direct and specific."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.8,
        )
        hard_question = hard_question.strip()
    except Exception:
        hard_question = None

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "open_commitments": [
            {
                "id": c["id"],
                "commitment": c["commitment"],
                "deadline": c.get("deadline"),
                "created_at": c.get("created_at"),
            }
            for c in open_commitments
        ],
        "stale_assumptions": [
            {
                "id": a["id"],
                "assumption": a["assumption"],
                "category": a.get("category", "general"),
                "created_at": a.get("created_at"),
            }
            for a in stale_assumptions
        ],
        "unresolved_contradictions": [
            {
                "id": ct["id"],
                "old_statement": ct["old_statement"],
                "new_statement": ct["new_statement"],
            }
            for ct in unresolved_contradictions
        ],
        "active_decisions_count": len(active_decisions),
        "untested_assumptions_count": len(untested_assumptions),
        "hard_question": hard_question,
    }
