"use client";

import { useEffect, useState } from "react";
import { api, Assumption } from "@/lib/api";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "untested", label: "Untested" },
  { value: "confirmed", label: "Confirmed" },
  { value: "busted", label: "Busted" },
];

const CATEGORY_COLORS: Record<string, string> = {
  customer: "bg-blue-900/50 text-blue-300",
  market: "bg-purple-900/50 text-purple-300",
  product: "bg-green-900/50 text-green-300",
  revenue: "bg-yellow-900/50 text-yellow-300",
  technical: "bg-cyan-900/50 text-cyan-300",
  general: "bg-gray-800 text-gray-400",
};

const STATUS_STYLES: Record<string, { bg: string; icon: string }> = {
  untested: { bg: "border-gray-700", icon: "?" },
  confirmed: { bg: "border-green-700", icon: "+" },
  busted: { bg: "border-red-700", icon: "x" },
};

export default function AssumptionsPage() {
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"confirm" | "bust" | null>(null);
  const [evidence, setEvidence] = useState("");

  useEffect(() => {
    loadAssumptions();
  }, [filter]);

  async function loadAssumptions() {
    setLoading(true);
    try {
      const res = await api.getAssumptions(filter || undefined);
      setAssumptions(res.assumptions);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction() {
    if (!actionId || !actionType) return;
    if (actionType === "confirm") {
      await api.confirmAssumption(actionId, evidence);
    } else {
      await api.bustAssumption(actionId, evidence);
    }
    setActionId(null);
    setActionType(null);
    setEvidence("");
    loadAssumptions();
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function daysAgo(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  }

  const counts = {
    total: assumptions.length,
    untested: assumptions.filter((a) => a.status === "untested").length,
    confirmed: assumptions.filter((a) => a.status === "confirmed").length,
    busted: assumptions.filter((a) => a.status === "busted").length,
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Assumption Graveyard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every unvalidated belief your startup is built on. Confirm or bust them.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-xl font-bold">{counts.total}</div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3">
          <div className="text-xs text-gray-400">Untested</div>
          <div className="text-xl font-bold text-gray-300">{counts.untested}</div>
        </div>
        <div className="bg-green-950/30 border border-green-800 rounded-lg px-4 py-3">
          <div className="text-xs text-green-400">Confirmed</div>
          <div className="text-xl font-bold text-green-400">{counts.confirmed}</div>
        </div>
        <div className="bg-red-950/30 border border-red-800 rounded-lg px-4 py-3">
          <div className="text-xs text-red-400">Busted</div>
          <div className="text-xl font-bold text-red-400">{counts.busted}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f.value
                ? "bg-brand-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Evidence modal */}
      {actionId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-1">
              {actionType === "confirm" ? "Confirm Assumption" : "Bust Assumption"}
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              What evidence {actionType === "confirm" ? "validates" : "disproves"} this?
            </p>
            <textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="Customer interviews showed... / Data from analytics... / We tested and..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 min-h-[100px] mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setActionId(null); setActionType(null); setEvidence(""); }}
                className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                className={`px-4 py-2 text-sm rounded-lg font-medium ${
                  actionType === "confirm"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionType === "confirm" ? "Confirm" : "Bust"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assumptions list */}
      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : assumptions.length === 0 ? (
        <div className="text-center text-gray-500 mt-16">
          <p className="text-lg mb-2">No assumptions tracked yet.</p>
          <p className="text-sm">
            Start a session — your co-founder will automatically detect unvalidated beliefs.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assumptions.map((a) => {
            const style = STATUS_STYLES[a.status] || STATUS_STYLES.untested;
            const catColor = CATEGORY_COLORS[a.category] || CATEGORY_COLORS.general;
            const age = daysAgo(a.date);
            const isStale = a.status === "untested" && age >= 30;

            return (
              <div
                key={a.id}
                className={`border rounded-lg p-4 ${style.bg} ${
                  isStale ? "bg-amber-950/20" : "bg-gray-900"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${catColor}`}>
                        {a.category}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          a.status === "confirmed"
                            ? "bg-green-900/50 text-green-400"
                            : a.status === "busted"
                            ? "bg-red-900/50 text-red-400"
                            : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {a.status}
                      </span>
                      {isStale && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-400">
                          {age}d untested
                        </span>
                      )}
                    </div>

                    <p className="text-sm">{a.assumption}</p>

                    {a.evidence && (
                      <div className="mt-2 text-xs text-gray-400 bg-gray-800/50 rounded px-3 py-2">
                        <span className="font-medium">Evidence:</span> {a.evidence}
                      </div>
                    )}

                    <div className="text-xs text-gray-600 mt-2">
                      {formatDate(a.date)}
                      {a.tested_at && ` — tested ${formatDate(a.tested_at)}`}
                    </div>
                  </div>

                  {a.status === "untested" && (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => { setActionId(a.id); setActionType("confirm"); }}
                        className="px-3 py-1.5 text-xs bg-green-900/40 text-green-400 hover:bg-green-900/60 rounded-lg transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => { setActionId(a.id); setActionType("bust"); }}
                        className="px-3 py-1.5 text-xs bg-red-900/40 text-red-400 hover:bg-red-900/60 rounded-lg transition-colors"
                      >
                        Bust
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
