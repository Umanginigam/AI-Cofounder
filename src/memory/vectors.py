"""
ChromaDB-backed vector store for semantic search over past conversations.

Stores session summaries, key statements, decisions, and commitments
as embeddings for similarity retrieval.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import chromadb

from src.llm.client import embed

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CHROMA_DIR = DATA_DIR / "chroma"
COLLECTION_NAME = "startup_memory"

_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None


def _get_collection() -> chromadb.Collection:
    global _client, _collection
    if _collection is None:
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def add_memory(
    text: str,
    memory_id: str,
    metadata: dict[str, Any] | None = None,
):
    """Store a piece of text with its embedding in the vector store."""
    collection = _get_collection()
    embedding = embed(text)
    collection.upsert(
        ids=[memory_id],
        embeddings=[embedding],
        documents=[text],
        metadatas=[metadata or {}],
    )


def search_memory(
    query: str,
    n_results: int = 5,
    where: dict | None = None,
) -> list[dict[str, Any]]:
    """Semantic search over stored memories. Returns list of {text, metadata, distance}."""
    collection = _get_collection()
    if collection.count() == 0:
        return []

    query_embedding = embed(query)

    kwargs: dict[str, Any] = {
        "query_embeddings": [query_embedding],
        "n_results": min(n_results, collection.count()),
    }
    if where:
        kwargs["where"] = where

    results = collection.query(**kwargs)

    memories = []
    for i in range(len(results["ids"][0])):
        memories.append({
            "id": results["ids"][0][i],
            "text": results["documents"][0][i],
            "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
            "distance": results["distances"][0][i] if results["distances"] else None,
        })
    return memories


def add_session_summary(session_id: int, summary: str):
    add_memory(
        text=summary,
        memory_id=f"session_{session_id}_summary",
        metadata={"type": "session_summary", "session_id": session_id},
    )


def add_decision_memory(session_id: int, decision_id: int, text: str):
    add_memory(
        text=text,
        memory_id=f"decision_{decision_id}",
        metadata={"type": "decision", "session_id": session_id},
    )


def add_commitment_memory(session_id: int, commitment_id: int, text: str):
    add_memory(
        text=text,
        memory_id=f"commitment_{commitment_id}",
        metadata={"type": "commitment", "session_id": session_id},
    )


def add_insight_memory(session_id: int, insight_id: str, text: str):
    add_memory(
        text=text,
        memory_id=f"insight_{insight_id}",
        metadata={"type": "insight", "session_id": session_id},
    )
