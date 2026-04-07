"use client";

import { useEffect, useState } from "react";
import { api, Briefing } from "@/lib/api";

export default function Dashboard() {
  const [context, setContext] = useState<Record<string, string>>({});
  const [health, setHealth] = useState<Record<string, string>>({});
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);

  useEffect(() => {
    api.onboardStatus().then((r) => setOnboarded(r.onboarded));
    api.getContext().then((r) => {
      setContext(r.context);
      setHealth(r.health);
    }).catch(() => {});
    api.getUsage().then((r) => {
      setUsage(r.usage);
      setLimits(r.limits);
    }).catch(() => {});
  }, []);

  async function loadBriefing() {
    setBriefingLoading(true);
    setShowBriefing(true);
    try {
      const b = await api.getBriefing();
      setBriefing(b);
    } catch {
      setBriefing(null);
    } finally {
      setBriefingLoading(false);
    }
  }

  if (onboarded === false) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Welcome to CoFounder AI</h1>
        <p className="text-gray-400 mb-8">
          Let's get to know your startup first.
        </p>
        <a
          href="/onboard"
          className="inline-block px-6 py-3 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition-colors"
        >
          Start Onboarding
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={loadBriefing}
          disabled={briefingLoading}
          className="px-4 py-2 text-sm bg-amber-900/40 text-amber-300 border border-amber-800 hover:bg-amber-900/60 rounded-lg transition-colors disabled:opacity-50"
        >
          {briefingLoading ? "Generating..." : "Monday Briefing"}
        </button>
      </div>

      {/* Monday Morning Briefing */}
      {showBriefing && (
        <div className="mb-8 border border-amber-800 rounded-xl bg-amber-950/20 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-amber-900/30 border-b border-amber-800">
            <h2 className="text-sm font-semibold text-amber-300">Monday Morning Briefing</h2>
            <button
              onClick={() => setShowBriefing(false)}
              className="text-amber-500 hover:text-amber-300 text-sm"
            >
              Dismiss
            </button>
          </div>

          {briefingLoading ? (
            <div className="p-5 text-sm text-gray-400">Generating your briefing...</div>
          ) : briefing ? (
            <div className="p-5 space-y-5">
              {/* Hard question */}
              {briefing.hard_question && (
                <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4">
                  <div className="text-xs text-amber-500 font-medium mb-1">Hard Question This Week</div>
                  <p className="text-sm text-amber-100 italic">{briefing.hard_question}</p>
                </div>
              )}

              {/* Open commitments */}
              {briefing.open_commitments.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 font-medium mb-2">
                    Open Commitments ({briefing.open_commitments.length})
                  </div>
                  <div className="space-y-1.5">
                    {briefing.open_commitments.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span>{c.commitment}</span>
                        {c.deadline && (
                          <span className="text-xs text-gray-500 ml-auto">due {c.deadline}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stale assumptions */}
              {briefing.stale_assumptions.length > 0 && (
                <div>
                  <div className="text-xs text-red-400 font-medium mb-2">
                    Stale Assumptions — 30+ Days Untested ({briefing.stale_assumptions.length})
                  </div>
                  <div className="space-y-1.5">
                    {briefing.stale_assumptions.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5" />
                        <span>{a.assumption}</span>
                        <span className="text-xs text-gray-600 shrink-0 ml-auto">{a.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contradictions */}
              {briefing.unresolved_contradictions.length > 0 && (
                <div>
                  <div className="text-xs text-amber-400 font-medium mb-2">
                    Unresolved Contradictions ({briefing.unresolved_contradictions.length})
                  </div>
                  <div className="space-y-2">
                    {briefing.unresolved_contradictions.map((ct) => (
                      <div key={ct.id} className="text-sm bg-gray-900/50 rounded px-3 py-2">
                        <span className="text-gray-400">Before: </span>{ct.old_statement}
                        <br />
                        <span className="text-gray-400">Now: </span>{ct.new_statement}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary line */}
              <div className="text-xs text-gray-500 pt-2 border-t border-amber-900/30">
                {briefing.active_decisions_count} active decisions
                {" / "}
                {briefing.untested_assumptions_count} untested assumptions
              </div>
            </div>
          ) : (
            <div className="p-5 text-sm text-gray-500">Could not generate briefing.</div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Open Commitments"
          value={health.open_commitments || "0"}
        />
        <StatCard
          label="Active Decisions"
          value={health.active_decisions || "0"}
        />
        <StatCard
          label="Untested Assumptions"
          value={health.untested_assumptions || "0"}
          alert={Number(health.stale_assumptions || 0) > 0}
        />
        <StatCard
          label="Contradictions"
          value={health.unresolved_contradictions || "0"}
          alert={Number(health.unresolved_contradictions || 0) > 0}
        />
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-300">
          Startup Context
        </h2>
        {Object.keys(context).length === 0 ? (
          <p className="text-gray-500 text-sm">No context yet.</p>
        ) : (
          <div className="bg-gray-900 rounded-lg border border-gray-800 divide-y divide-gray-800">
            {Object.entries(context).map(([key, value]) => (
              <div key={key} className="flex px-4 py-3">
                <span className="text-gray-400 w-44 shrink-0 text-sm">
                  {key}
                </span>
                <span className="text-sm">{value}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-300">
          API Usage Today
        </h2>
        <div className="flex gap-4">
          {Object.entries(usage).map(([model, count]) => (
            <div
              key={model}
              className="bg-gray-900 rounded-lg border border-gray-800 px-4 py-3 text-sm"
            >
              <div className="text-gray-400">{model}</div>
              <div className="text-lg font-mono mt-1">
                {count}
                <span className="text-gray-600">
                  /{limits[model] || "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 flex gap-3">
        <a
          href="/session"
          className="inline-block px-6 py-3 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition-colors"
        >
          Start a Session
        </a>
        <a
          href="/assumptions"
          className="inline-block px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg font-medium transition-colors text-gray-300"
        >
          Assumption Graveyard
        </a>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-4 ${
        alert
          ? "border-amber-700 bg-amber-950/30"
          : "border-gray-800 bg-gray-900"
      }`}
    >
      <div className="text-sm text-gray-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${alert ? "text-amber-400" : ""}`}>
        {value}
      </div>
    </div>
  );
}
