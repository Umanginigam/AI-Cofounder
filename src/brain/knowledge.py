"""
Startup knowledge graph helpers.

Provides a high-level view of the startup's current state by assembling
structured data from the store into a readable snapshot.
"""

from __future__ import annotations

from src.memory import store


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

    return indicators
