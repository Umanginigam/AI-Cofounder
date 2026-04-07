"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import ChatMessage from "@/components/ChatMessage";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export default function OnboardPage() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleStart() {
    setLoading(true);
    try {
      const res = await api.onboardStart();
      setSessionId(res.session_id);
      if (res.opening_message) {
        setMessages([{ role: "assistant", content: res.opening_message }]);
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
      const res = await api.onboardMessage(sessionId, msg);
      const cleaned = res.response.replace("ONBOARDING_COMPLETE", "").trim();
      setMessages((prev) => [...prev, { role: "assistant", content: cleaned }]);
      if (res.response.includes("ONBOARDING_COMPLETE")) {
        setComplete(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!sessionId) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Onboard Your Startup</h1>
        <p className="text-gray-400 mb-8 text-sm">
          Tell your co-founder about your startup through a guided conversation.
          It'll take about 5 minutes.
        </p>
        <button
          onClick={handleStart}
          disabled={loading}
          className="px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
        >
          {loading ? "Starting..." : "Let's Go"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      <h1 className="text-lg font-bold mb-4">Onboarding</h1>

      <div className="flex-1 overflow-y-auto scrollbar-thin pr-2">
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role as "user" | "assistant"} content={msg.content} />
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

      {complete ? (
        <div className="mt-4 text-center">
          <p className="text-green-400 mb-4">
            Onboarding complete! Your co-founder now knows your startup.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      ) : (
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
            placeholder="Tell your co-founder..."
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
    </div>
  );
}
