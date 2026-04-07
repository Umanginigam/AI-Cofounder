"""
SQLite-backed persistent storage for the startup knowledge graph.

Tables: startup_context, sessions, messages, decisions, commitments, contradictions.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DB_PATH = DATA_DIR / "cofounder.db"

_conn: sqlite3.Connection | None = None


def _get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("PRAGMA foreign_keys=ON")
        _init_tables(_conn)
    return _conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _init_tables(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS startup_context (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            field    TEXT NOT NULL,
            value    TEXT NOT NULL,
            version  INTEGER DEFAULT 1,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            session_type TEXT,
            summary      TEXT,
            started_at   TEXT,
            ended_at     TEXT
        );

        CREATE TABLE IF NOT EXISTS messages (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES sessions(id),
            role       TEXT NOT NULL,
            content    TEXT NOT NULL,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS decisions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES sessions(id),
            decision   TEXT NOT NULL,
            rationale  TEXT,
            confidence TEXT DEFAULT 'medium',
            status     TEXT DEFAULT 'active',
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS commitments (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES sessions(id),
            commitment TEXT NOT NULL,
            deadline   TEXT,
            status     TEXT DEFAULT 'open',
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS contradictions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            old_statement   TEXT,
            new_statement   TEXT,
            old_session_id  INTEGER,
            new_session_id  INTEGER,
            resolved        INTEGER DEFAULT 0,
            created_at      TEXT
        );
    """)
    conn.commit()


# ---------------------------------------------------------------------------
# Startup context
# ---------------------------------------------------------------------------

def set_context(field: str, value: str):
    conn = _get_conn()
    existing = conn.execute(
        "SELECT id, version FROM startup_context WHERE field = ? ORDER BY version DESC LIMIT 1",
        (field,),
    ).fetchone()
    now = _now()
    if existing:
        conn.execute(
            "INSERT INTO startup_context (field, value, version, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (field, value, existing["version"] + 1, now, now),
        )
    else:
        conn.execute(
            "INSERT INTO startup_context (field, value, version, created_at, updated_at) "
            "VALUES (?, ?, 1, ?, ?)",
            (field, value, now, now),
        )
    conn.commit()


def get_context(field: str | None = None) -> list[dict[str, Any]]:
    conn = _get_conn()
    if field:
        rows = conn.execute(
            "SELECT field, value, version, updated_at FROM startup_context "
            "WHERE field = ? ORDER BY version DESC LIMIT 1",
            (field,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT sc.field, sc.value, sc.version, sc.updated_at "
            "FROM startup_context sc "
            "INNER JOIN ("
            "  SELECT field, MAX(version) AS max_v FROM startup_context GROUP BY field"
            ") latest ON sc.field = latest.field AND sc.version = latest.max_v "
            "ORDER BY sc.field",
        ).fetchall()
    return [dict(r) for r in rows]


def get_all_context_formatted() -> str:
    rows = get_context()
    if not rows:
        return "No startup context recorded yet."
    lines = []
    for r in rows:
        lines.append(f"- **{r['field']}**: {r['value']}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

def create_session(session_type: str = "general") -> int:
    conn = _get_conn()
    cur = conn.execute(
        "INSERT INTO sessions (session_type, started_at) VALUES (?, ?)",
        (session_type, _now()),
    )
    conn.commit()
    return cur.lastrowid


def end_session(session_id: int, summary: str | None = None):
    conn = _get_conn()
    conn.execute(
        "UPDATE sessions SET ended_at = ?, summary = ? WHERE id = ?",
        (_now(), summary, session_id),
    )
    conn.commit()


def get_session(session_id: int) -> dict | None:
    conn = _get_conn()
    row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    return dict(row) if row else None


def get_recent_sessions(limit: int = 5) -> list[dict]:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT * FROM sessions ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

def add_message(session_id: int, role: str, content: str) -> int:
    conn = _get_conn()
    cur = conn.execute(
        "INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (session_id, role, content, _now()),
    )
    conn.commit()
    return cur.lastrowid


def get_messages(session_id: int) -> list[dict]:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT role, content, created_at FROM messages WHERE session_id = ? ORDER BY id",
        (session_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_recent_messages(session_id: int, limit: int = 20) -> list[dict]:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?",
        (session_id, limit),
    ).fetchall()
    return [dict(r) for r in reversed(rows)]


# ---------------------------------------------------------------------------
# Decisions
# ---------------------------------------------------------------------------

def add_decision(
    session_id: int,
    decision: str,
    rationale: str = "",
    confidence: str = "medium",
) -> int:
    conn = _get_conn()
    cur = conn.execute(
        "INSERT INTO decisions (session_id, decision, rationale, confidence, created_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (session_id, decision, rationale, confidence, _now()),
    )
    conn.commit()
    return cur.lastrowid


def get_decisions(status: str | None = "active") -> list[dict]:
    conn = _get_conn()
    if status:
        rows = conn.execute(
            "SELECT * FROM decisions WHERE status = ? ORDER BY id DESC", (status,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM decisions ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]


def update_decision_status(decision_id: int, status: str):
    conn = _get_conn()
    conn.execute("UPDATE decisions SET status = ? WHERE id = ?", (status, decision_id))
    conn.commit()


# ---------------------------------------------------------------------------
# Commitments
# ---------------------------------------------------------------------------

def add_commitment(
    session_id: int, commitment: str, deadline: str | None = None
) -> int:
    conn = _get_conn()
    cur = conn.execute(
        "INSERT INTO commitments (session_id, commitment, deadline, created_at) "
        "VALUES (?, ?, ?, ?)",
        (session_id, commitment, deadline, _now()),
    )
    conn.commit()
    return cur.lastrowid


def get_commitments(status: str | None = "open") -> list[dict]:
    conn = _get_conn()
    if status:
        rows = conn.execute(
            "SELECT * FROM commitments WHERE status = ? ORDER BY id DESC", (status,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM commitments ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]


def update_commitment_status(commitment_id: int, status: str):
    conn = _get_conn()
    conn.execute(
        "UPDATE commitments SET status = ? WHERE id = ?", (status, commitment_id)
    )
    conn.commit()


# ---------------------------------------------------------------------------
# Contradictions
# ---------------------------------------------------------------------------

def add_contradiction(
    old_statement: str,
    new_statement: str,
    old_session_id: int | None = None,
    new_session_id: int | None = None,
) -> int:
    conn = _get_conn()
    cur = conn.execute(
        "INSERT INTO contradictions "
        "(old_statement, new_statement, old_session_id, new_session_id, created_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (old_statement, new_statement, old_session_id, new_session_id, _now()),
    )
    conn.commit()
    return cur.lastrowid


def get_contradictions(resolved: bool = False) -> list[dict]:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT * FROM contradictions WHERE resolved = ? ORDER BY id DESC",
        (int(resolved),),
    ).fetchall()
    return [dict(r) for r in rows]


def resolve_contradiction(contradiction_id: int):
    conn = _get_conn()
    conn.execute(
        "UPDATE contradictions SET resolved = 1 WHERE id = ?", (contradiction_id,)
    )
    conn.commit()


def has_onboarded() -> bool:
    """Check if the user has gone through onboarding (has any startup context)."""
    conn = _get_conn()
    row = conn.execute("SELECT COUNT(*) FROM startup_context").fetchone()
    return row[0] > 0
