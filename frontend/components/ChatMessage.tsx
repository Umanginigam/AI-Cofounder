"use client";

import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  modelUsed?: string;
}

export default function ChatMessage({
  role,
  content,
  modelUsed,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-brand-600 text-white rounded-br-md"
            : "bg-gray-800 text-gray-100 rounded-bl-md"
        }`}
      >
        {!isUser && (
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-2">
            <span className="font-medium text-brand-400">CoFounder</span>
            {modelUsed && modelUsed !== "gpt-4o" && (
              <span className="text-gray-600">({modelUsed})</span>
            )}
          </div>
        )}
        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
