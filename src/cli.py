"""
CLI entry point for CoFounder AI.

Usage:
    cofounder onboard          — First-time startup setup
    cofounder start            — Start a thinking session
    cofounder checkin          — Weekly check-in
    cofounder status           — View startup snapshot
    cofounder decisions        — View decisions
    cofounder commitments      — View commitments
    cofounder usage            — View daily API usage
"""

from __future__ import annotations

import typer
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt

from src.brain import session as session_mgr, knowledge, tracker
from src.llm import client, chains
from src.memory import store

app = typer.Typer(
    name="cofounder",
    help="Your AI co-founder — a thinking partner that remembers everything and pushes back.",
    no_args_is_help=True,
)
console = Console()


# ---------------------------------------------------------------------------
# Onboarding
# ---------------------------------------------------------------------------

@app.command()
def onboard():
    """First-time setup — teach your co-founder about your startup."""
    if store.has_onboarded():
        if not typer.confirm("You've already onboarded. Re-run to update your startup context?"):
            raise typer.Abort()

    console.print(
        Panel(
            "[bold]Welcome to CoFounder AI[/bold]\n\n"
            "I'm going to ask you about your startup so I can be a useful thinking partner.\n"
            "Just talk naturally — I'll ask one question at a time.\n\n"
            "[dim]Type 'done' at any time to finish early.[/dim]",
            border_style="blue",
        )
    )

    session_id = session_mgr.start_session("onboarding")
    messages_for_extraction: list[dict[str, str]] = []

    first_prompt = (
        "Let's start. Tell me — what are you building, and why does it matter to you?"
    )
    console.print()
    console.print(Markdown(f"**CoFounder:** {first_prompt}"))
    console.print()
    store.add_message(session_id, "assistant", first_prompt)
    messages_for_extraction.append({"role": "assistant", "content": first_prompt})

    while True:
        try:
            user_input = Prompt.ask("[bold cyan]You[/bold cyan]")
        except (KeyboardInterrupt, EOFError):
            user_input = "done"

        if not user_input.strip():
            continue

        if user_input.strip().lower() == "done":
            break

        store.add_message(session_id, "user", user_input)
        messages_for_extraction.append({"role": "user", "content": user_input})

        all_msgs = session_mgr.build_prompt(session_id, user_input, "onboarding")
        response_text, model = client.think(all_msgs)

        store.add_message(session_id, "assistant", response_text)
        messages_for_extraction.append({"role": "assistant", "content": response_text})

        onboarding_complete = "ONBOARDING_COMPLETE" in response_text
        display_text = response_text.replace("ONBOARDING_COMPLETE", "").strip()

        console.print()
        console.print(Markdown(f"**CoFounder:** {display_text}"))
        console.print()

        if onboarding_complete:
            break

    console.print("[dim]Extracting your startup context...[/dim]")
    extracted = chains.extract_onboarding(messages_for_extraction)
    session_mgr.end_session(session_id)

    if extracted:
        console.print(
            Panel(
                "\n".join(f"[bold]{k}[/bold]: {v}" for k, v in extracted.items()),
                title="Startup Context Saved",
                border_style="green",
            )
        )
    else:
        console.print("[yellow]Couldn't extract structured context. You can update it manually with `cofounder context`.[/yellow]")

    console.print("\n[bold green]Onboarding complete![/bold green] Run `cofounder start` to begin a session.\n")


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------

@app.command()
def start(
    session_type: str = typer.Option(
        "general",
        "--type", "-t",
        help="Session type: general, strategy, decision, quick",
    ),
):
    """Start a thinking session with your co-founder."""
    if not store.has_onboarded():
        console.print("[yellow]You haven't onboarded yet. Run `cofounder onboard` first.[/yellow]")
        raise typer.Abort()

    session_id = session_mgr.start_session(session_type)
    console.print(
        Panel(
            f"[bold]Session #{session_id}[/bold] ({session_type})\n"
            "[dim]Type 'quit' or 'exit' to end the session. Ctrl+C works too.[/dim]",
            border_style="blue",
        )
    )

    opening = _get_session_opening(session_type)
    if opening:
        console.print()
        console.print(Markdown(f"**CoFounder:** {opening}"))
        console.print()
        store.add_message(session_id, "assistant", opening)

    _conversation_loop(session_id, session_type)


@app.command()
def checkin():
    """Weekly check-in — review commitments, metrics, and progress."""
    if not store.has_onboarded():
        console.print("[yellow]You haven't onboarded yet. Run `cofounder onboard` first.[/yellow]")
        raise typer.Abort()

    session_id = session_mgr.start_session("checkin")
    console.print(
        Panel(
            f"[bold]Weekly Check-in — Session #{session_id}[/bold]\n"
            "[dim]Type 'quit' or 'exit' to end. Ctrl+C works too.[/dim]",
            border_style="blue",
        )
    )

    commitments = store.get_commitments(status="open")
    if commitments:
        opening = "Time for your check-in. Let's start with your open commitments:\n\n"
        for c in commitments:
            deadline = f" (deadline: {c['deadline']})" if c.get("deadline") else ""
            opening += f"- {c['commitment']}{deadline}\n"
        opening += "\nWhat's the status on these? Let's go through them."
    else:
        opening = "Time for your weekly check-in. What happened this week that matters?"

    console.print()
    console.print(Markdown(f"**CoFounder:** {opening}"))
    console.print()
    store.add_message(session_id, "assistant", opening)

    _conversation_loop(session_id, "checkin")


def _get_session_opening(session_type: str) -> str | None:
    """Generate an opening message based on session type."""
    if session_type == "strategy":
        return "Strategy session. What's on your mind? What strategic question are you wrestling with?"
    elif session_type == "decision":
        return "Decision time. What decision are you trying to make? Walk me through the options you're considering."
    elif session_type == "quick":
        return "Quick question mode. What do you need?"
    else:
        return "What are you thinking about today?"


def _conversation_loop(session_id: int, session_type: str):
    """Main conversation loop — runs until user exits."""
    while True:
        try:
            user_input = Prompt.ask("\n[bold cyan]You[/bold cyan]")
        except (KeyboardInterrupt, EOFError):
            user_input = "quit"

        if not user_input.strip():
            continue

        if user_input.strip().lower() in ("quit", "exit"):
            break

        with console.status("[dim]Thinking...[/dim]"):
            response_text, model_used = session_mgr.process_message(
                session_id, user_input, session_type
            )

        model_tag = f" [dim]({model_used})[/dim]" if model_used != "gpt-4o" else ""
        console.print()
        console.print(Markdown(f"**CoFounder:**{model_tag} {response_text}"))

    console.print("\n[dim]Wrapping up session...[/dim]")
    summary = session_mgr.end_session(session_id)

    if summary:
        console.print(
            Panel(summary, title="Session Summary", border_style="green")
        )

    usage = client.get_daily_usage()
    if usage:
        strong = usage.get("gpt-4o", 0)
        fast = usage.get("gpt-4o-mini", 0)
        console.print(f"[dim]Today's usage: GPT-4o: {strong}/{client.DAILY_STRONG_LIMIT} | GPT-4o-mini: {fast}/{client.DAILY_FAST_LIMIT}[/dim]")

    console.print()


# ---------------------------------------------------------------------------
# Status & info commands
# ---------------------------------------------------------------------------

@app.command()
def status():
    """View your startup's current state."""
    if not store.has_onboarded():
        console.print("[yellow]No startup context yet. Run `cofounder onboard` first.[/yellow]")
        raise typer.Abort()

    snapshot = knowledge.get_startup_snapshot()
    table = Table(title="Startup Context", show_header=True, header_style="bold blue")
    table.add_column("Field", style="bold")
    table.add_column("Value")

    for label, value in snapshot.items():
        table.add_row(label, value)

    console.print(table)

    indicators = knowledge.get_health_indicators()
    console.print()
    for key, value in indicators.items():
        label = key.replace("_", " ").title()
        console.print(f"  {label}: {value}")
    console.print()


@app.command()
def decisions(
    all_statuses: bool = typer.Option(False, "--all", "-a", help="Show all decisions, not just active"),
):
    """View tracked decisions."""
    status_filter = None if all_statuses else "active"
    items = tracker.get_decisions_display(status=status_filter)

    if not items:
        console.print("[dim]No decisions recorded yet.[/dim]")
        return

    table = Table(title="Decisions", show_header=True, header_style="bold blue")
    table.add_column("ID", style="dim", width=4)
    table.add_column("Decision")
    table.add_column("Confidence", width=10)
    table.add_column("Status", width=10)
    table.add_column("Date", width=12)

    for d in items:
        conf_style = {"high": "green", "medium": "yellow", "low": "red"}.get(
            d["confidence"], "white"
        )
        table.add_row(
            str(d["id"]),
            d["decision"],
            f"[{conf_style}]{d['confidence']}[/{conf_style}]",
            d["status"],
            d["date"][:10] if d["date"] else "",
        )

    console.print(table)


@app.command()
def commitments(
    all_statuses: bool = typer.Option(False, "--all", "-a", help="Show all commitments, not just open"),
):
    """View tracked commitments."""
    status_filter = None if all_statuses else "open"
    items = tracker.get_commitments_display(status=status_filter)

    if not items:
        console.print("[dim]No commitments recorded yet.[/dim]")
        return

    table = Table(title="Commitments", show_header=True, header_style="bold blue")
    table.add_column("ID", style="dim", width=4)
    table.add_column("Commitment")
    table.add_column("Deadline", width=12)
    table.add_column("Status", width=10)

    for c in items:
        table.add_row(
            str(c["id"]),
            c["commitment"],
            c["deadline"] or "—",
            c["status"],
        )

    console.print(table)


@app.command()
def done(commitment_id: int = typer.Argument(..., help="Commitment ID to mark as done")):
    """Mark a commitment as done."""
    tracker.mark_commitment_done(commitment_id)
    console.print(f"[green]Commitment #{commitment_id} marked as done.[/green]")


@app.command()
def drop(commitment_id: int = typer.Argument(..., help="Commitment ID to drop")):
    """Drop a commitment (no longer pursuing)."""
    tracker.mark_commitment_dropped(commitment_id)
    console.print(f"[yellow]Commitment #{commitment_id} dropped.[/yellow]")


@app.command()
def usage():
    """Show today's API usage."""
    all_usage = client.get_daily_usage()

    if not all_usage:
        console.print("[dim]No API calls made today.[/dim]")
        return

    table = Table(title="Today's API Usage", show_header=True, header_style="bold blue")
    table.add_column("Model")
    table.add_column("Calls", justify="right")
    table.add_column("Limit", justify="right")

    limits = {
        "gpt-4o": str(client.DAILY_STRONG_LIMIT),
        "gpt-4o-mini": str(client.DAILY_FAST_LIMIT),
        "text-embedding-3-small": "150",
    }

    for model_name, count in sorted(all_usage.items()):
        limit = limits.get(model_name, "—")
        table.add_row(model_name, str(count), limit)

    console.print(table)


@app.command()
def context(
    field: str = typer.Argument(..., help="Context field to update (e.g., problem, icp, model)"),
    value: str = typer.Argument(..., help="New value for the field"),
):
    """Manually update a startup context field."""
    store.set_context(field, value)
    console.print(f"[green]Updated '{field}' to: {value}[/green]")


if __name__ == "__main__":
    app()
