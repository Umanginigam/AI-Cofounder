"use client";

import { useEffect, useState } from "react";
import { api, Decision } from "@/lib/api";

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    load();
  }, [showAll]);

  async function load() {
    const res = await api.getDecisions(showAll ? undefined : "active");
    setDecisions(res.decisions);
  }

  async function handleReverse(id: number) {
    await api.reverseDecision(id);
    load();
  }

  const confidenceColor: Record<string, string> = {
    high: "text-green-400",
    medium: "text-yellow-400",
    low: "text-red-400",
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Decision Journal</h1>
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

      {decisions.length === 0 ? (
        <p className="text-gray-500">
          No decisions recorded yet. Start a session and make some choices.
        </p>
      ) : (
        <div className="space-y-3">
          {decisions.map((d) => (
            <div
              key={d.id}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{d.decision}</div>
                  {d.rationale && (
                    <div className="text-sm text-gray-400 mt-1">
                      {d.rationale}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span
                    className={`text-xs font-medium ${
                      confidenceColor[d.confidence] || "text-gray-400"
                    }`}
                  >
                    {d.confidence}
                  </span>
                  {d.status === "active" && (
                    <button
                      onClick={() => handleReverse(d.id)}
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                    >
                      Reverse
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                <span>{d.date?.slice(0, 10)}</span>
                <span
                  className={`px-2 py-0.5 rounded-full ${
                    d.status === "active"
                      ? "bg-green-900/40 text-green-400"
                      : d.status === "reversed"
                      ? "bg-red-900/40 text-red-400"
                      : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {d.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
