"use client";

import { useEffect, useState } from "react";
import { api, Message } from "@/lib/api";

interface Session {
  id: number;
  session_type: string;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
}

export default function CallHistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSessions(50).then((res) => {
      const voiceSessions = res.sessions.filter(
        (s: Session) =>
          s.session_type === "voice" ||
          s.session_type === "phone_call"
      );
      setSessions(voiceSessions);
      setLoading(false);
    });
  }, []);

  async function toggleExpand(id: number) {
    if (expanded === id) {
      setExpanded(null);
      setMessages([]);
      return;
    }
    setExpanded(id);
    setLoadingMessages(true);
    try {
      const res = await api.getSessionMessages(id);
      setMessages(res.messages);
    } finally {
      setLoadingMessages(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString();
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto mt-10 text-gray-500">Loading...</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Call History</h1>

      {sessions.length === 0 && (
        <div className="text-gray-500 text-center mt-20">
          <p className="mb-2">No voice sessions yet.</p>
          <p className="text-sm">
            Start a call from the{" "}
            <a href="/call" className="text-brand-400 underline">
              Call
            </a>{" "}
            page, or connect via phone with Vapi.ai.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="border border-gray-800 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggleExpand(session.id)}
              className="w-full flex items-center justify-between px-5 py-4 bg-gray-900 hover:bg-gray-800 transition-colors text-left"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {session.session_type === "phone_call"
                      ? "Phone Call"
                      : "Voice Call"}
                  </span>
                  <span className="text-xs text-gray-500">
                    #{session.id}
                  </span>
                  {session.session_type === "phone_call" && (
                    <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">
                      Phone
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatDate(session.started_at)}
                  {session.ended_at && " — " + formatDate(session.ended_at)}
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${
                  expanded === session.id ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {expanded === session.id && (
              <div className="px-5 py-4 border-t border-gray-800">
                {session.summary && (
                  <div className="mb-4 p-3 bg-gray-900/50 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">Summary</div>
                    <div className="text-sm">{session.summary}</div>
                  </div>
                )}

                {loadingMessages ? (
                  <div className="text-gray-500 text-sm">
                    Loading transcript...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-gray-500 text-sm">
                    No messages in this session.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${
                          msg.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                            msg.role === "user"
                              ? "bg-brand-600/80 text-white rounded-br-md"
                              : "bg-gray-800 text-gray-100 rounded-bl-md"
                          }`}
                        >
                          <span className="text-xs text-gray-400 block mb-0.5">
                            {msg.role === "user" ? "You" : "CoFounder"}
                          </span>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
