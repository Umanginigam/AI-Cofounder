"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Dashboard() {
  const [context, setContext] = useState<Record<string, string>>({});
  const [health, setHealth] = useState<Record<string, string>>({});
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

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
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Open Commitments"
          value={health.open_commitments || "0"}
        />
        <StatCard
          label="Active Decisions"
          value={health.active_decisions || "0"}
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

      <div className="mt-8">
        <a
          href="/session"
          className="inline-block px-6 py-3 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition-colors"
        >
          Start a Session
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
