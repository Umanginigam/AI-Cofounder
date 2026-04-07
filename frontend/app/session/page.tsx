"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import ChatMessage from "@/components/ChatMessage";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  modelUsed?: string;
}

const SESSION_TYPES = [
  { value: "general", label: "General" },
  { value: "strategy", label: "Strategy" },
  { value: "decision", label: "Decision" },
  { value: "quick", label: "Quick" },
  { value: "checkin", label: "Check-in" },
];

export default function SessionPage() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionType, setSessionType] = useState("general");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ended, setEnded] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleStart() {
    setLoading(true);
    try {
      const res = await api.startSession(sessionType);
      setSessionId(res.session_id);
      setEnded(false);
      setSummary(null);
      if (res.opening_message) {
        setMessages([
          { role: "assistant", content: res.opening_message, modelUsed: "gpt-4o" },
        ]);
      } else {
        setMessages([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || !sessionId || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await api.sendMessage(sessionId, msg, sessionType);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.response, modelUsed: res.model_used },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${e.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleEnd() {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await api.endSession(sessionId);
      setSummary(res.summary);
      setEnded(true);
    } finally {
      setLoading(false);
    }
  }

  if (!sessionId) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <h1 className="text-2xl font-bold mb-6">Start a Session</h1>
        <label className="block text-sm text-gray-400 mb-2">Session Type</label>
        <div className="flex flex-wrap gap-2 mb-6">
          {SESSION_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setSessionType(t.value)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                sessionType === t.value
                  ? "bg-brand-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
        >
          {loading ? "Starting..." : "Begin Session"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">
            Session #{sessionId}
            <span className="text-gray-500 text-sm font-normal ml-2">
              {sessionType}
            </span>
          </h1>
        </div>
        {!ended && (
          <button
            onClick={handleEnd}
            className="px-4 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            End Session
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin pr-2">
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            role={msg.role}
            content={msg.content}
            modelUsed={msg.modelUsed}
          />
        ))}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {summary && (
        <div className="my-4 p-4 bg-gray-900 border border-gray-700 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">Session Summary</div>
          <div className="text-sm">{summary}</div>
        </div>
      )}

      {!ended && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What's on your mind..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 placeholder-gray-600"
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-30 rounded-xl text-sm font-medium transition-colors"
          >
            Send
          </button>
        </form>
      )}

      {ended && (
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setSessionId(null);
              setMessages([]);
              setEnded(false);
              setSummary(null);
            }}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition-colors"
          >
            Start New Session
          </button>
        </div>
      )}
    </div>
  );
}
