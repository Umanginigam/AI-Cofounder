const API = process.env.NEXT_PUBLIC_API_URL || "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export interface SessionStart {
  session_id: number;
  opening_message: string | null;
}

export interface MessageResult {
  response: string;
  model_used: string;
}

export interface Decision {
  id: number;
  decision: string;
  rationale: string;
  confidence: string;
  status: string;
  date: string;
}

export interface Commitment {
  id: number;
  commitment: string;
  deadline: string;
  status: string;
  date: string;
}

export interface Message {
  role: string;
  content: string;
  created_at?: string;
}

export interface Assumption {
  id: number;
  assumption: string;
  category: string;
  status: string;
  evidence: string | null;
  tested_at: string | null;
  date: string;
}

export interface Briefing {
  generated_at: string;
  open_commitments: { id: number; commitment: string; deadline: string | null; created_at: string }[];
  stale_assumptions: { id: number; assumption: string; category: string; created_at: string }[];
  unresolved_contradictions: { id: number; old_statement: string; new_statement: string }[];
  active_decisions_count: number;
  untested_assumptions_count: number;
  hard_question: string | null;
}

export const api = {
  // Onboarding
  onboardStatus: () => request<{ onboarded: boolean }>("/onboard/status"),
  onboardStart: () => request<SessionStart>("/onboard/start", { method: "POST" }),
  onboardMessage: (session_id: number, message: string) =>
    request<MessageResult>("/onboard/message", {
      method: "POST",
      body: JSON.stringify({ session_id, message }),
    }),

  // Sessions
  startSession: (session_type = "general") =>
    request<SessionStart>("/session/start", {
      method: "POST",
      body: JSON.stringify({ session_type }),
    }),
  sendMessage: (session_id: number, message: string, session_type = "general") =>
    request<MessageResult>("/session/message", {
      method: "POST",
      body: JSON.stringify({ session_id, message, session_type }),
    }),
  endSession: (session_id: number) =>
    request<{ summary: string | null }>(`/session/${session_id}/end`, {
      method: "POST",
    }),
  getSessions: (limit = 10) =>
    request<{ sessions: any[] }>(`/sessions?limit=${limit}`),
  getSessionMessages: (session_id: number) =>
    request<{ messages: Message[] }>(`/sessions/${session_id}/messages`),

  // Context
  getContext: () =>
    request<{ context: Record<string, string>; health: Record<string, string> }>(
      "/startup/context"
    ),
  updateContext: (field: string, value: string) =>
    request("/startup/context", {
      method: "POST",
      body: JSON.stringify({ field, value }),
    }),

  // Decisions & Commitments
  getDecisions: (status?: string) =>
    request<{ decisions: Decision[] }>(
      `/decisions${status ? `?status=${status}` : ""}`
    ),
  getCommitments: (status?: string) =>
    request<{ commitments: Commitment[] }>(
      `/commitments${status ? `?status=${status}` : ""}`
    ),
  markCommitmentDone: (id: number) =>
    request(`/commitments/${id}/done`, { method: "POST" }),
  dropCommitment: (id: number) =>
    request(`/commitments/${id}/drop`, { method: "POST" }),
  reverseDecision: (id: number) =>
    request(`/decisions/${id}/reverse`, { method: "POST" }),

  // Contradictions
  getContradictions: () => request<{ contradictions: any[] }>("/contradictions"),

  // Usage
  getUsage: () =>
    request<{
      usage: Record<string, number>;
      limits: Record<string, number>;
    }>("/usage"),

  // Assumptions
  getAssumptions: (status?: string) =>
    request<{ assumptions: Assumption[] }>(
      `/assumptions${status ? `?status=${status}` : ""}`
    ),
  getStaleAssumptions: (days = 30) =>
    request<{ assumptions: Assumption[] }>(`/assumptions/stale?days=${days}`),
  confirmAssumption: (id: number, evidence: string) =>
    request(`/assumptions/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ status: "confirmed", evidence }),
    }),
  bustAssumption: (id: number, evidence: string) =>
    request(`/assumptions/${id}/bust`, {
      method: "POST",
      body: JSON.stringify({ status: "busted", evidence }),
    }),

  // Briefing
  getBriefing: () => request<Briefing>("/briefing"),

  // Voice
  voiceStart: () =>
    request<{ session_id: number; call_id: string; opening_message: string }>(
      "/voice/browser-start",
      { method: "POST" }
    ),
  voiceMessage: (call_id: string, message: string) =>
    request<{ response: string; session_id: number; model_used: string }>(
      "/voice/message",
      { method: "POST", body: JSON.stringify({ call_id, message }) }
    ),
  voiceEnd: (call_id: string, session_id: number) =>
    request<{ summary: string | null }>("/voice/browser-end", {
      method: "POST",
      body: JSON.stringify({ call_id, session_id }),
    }),
};
