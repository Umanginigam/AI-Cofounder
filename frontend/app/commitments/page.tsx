"use client";

import { useEffect, useState } from "react";
import { api, Commitment } from "@/lib/api";

export default function CommitmentsPage() {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    load();
  }, [showAll]);

  async function load() {
    const res = await api.getCommitments(showAll ? undefined : "open");
    setCommitments(res.commitments);
  }

  async function handleDone(id: number) {
    await api.markCommitmentDone(id);
    load();
  }

  async function handleDrop(id: number) {
    await api.dropCommitment(id);
    load();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Commitment Tracker</h1>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="rounded"
          />
          Show all
        </label>
      </div>

      {commitments.length === 0 ? (
        <p className="text-gray-500">
          No commitments tracked yet. Your co-founder will pick these up during
          sessions.
        </p>
      ) : (
        <div className="space-y-3">
          {commitments.map((c) => (
            <div
              key={c.id}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{c.commitment}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {c.deadline && c.deadline !== "none" && (
                    <span>Due: {c.deadline}</span>
                  )}
                  <span>{c.date?.slice(0, 10)}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full ${
                      c.status === "open"
                        ? "bg-blue-900/40 text-blue-400"
                        : c.status === "done"
                        ? "bg-green-900/40 text-green-400"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              </div>
              {c.status === "open" && (
                <div className="flex gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => handleDone(c.id)}
                    className="px-3 py-1.5 text-xs bg-green-900/40 text-green-400 hover:bg-green-900/60 rounded-lg transition-colors"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => handleDrop(c.id)}
                    className="px-3 py-1.5 text-xs bg-gray-800 text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Drop
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
