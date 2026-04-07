"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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

  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const voiceModeRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveTranscript]);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  function speakText(text: string) {
    if (!autoSpeak) return Promise.resolve();
    return new Promise<void>((resolve) => {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => {
        setSpeaking(false);
        resolve();
      };
      utterance.onerror = () => {
        setSpeaking(false);
        resolve();
      };
      speechSynthesis.speak(utterance);
    });
  }

  function stopSpeaking() {
    speechSynthesis.cancel();
    setSpeaking(false);
  }

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported. Please use Chrome.");
      return;
    }

    stopSpeaking();

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    let finalText = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += t + " ";
        } else {
          interim += t;
        }
      }
      setLiveTranscript(finalText + interim);
    };

    recognition.onend = () => {
      setListening(false);
      if (finalText.trim()) {
        setLiveTranscript("");
        setInput(finalText.trim());
        if (voiceModeRef.current) {
          submitMessage(finalText.trim());
        }
      } else {
        setLiveTranscript("");
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.error("Speech recognition error:", e.error);
      }
      setListening(false);
      setLiveTranscript("");
    };

    recognition.start();
    setListening(true);
  }, []);

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }

  async function submitMessage(text: string) {
    if (!text.trim() || !sessionId || loading) return;
    const msg = text.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await api.sendMessage(sessionId, msg, sessionType);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.response, modelUsed: res.model_used },
      ]);
      if (autoSpeak) {
        await speakText(res.response);
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${e.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

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
        if (autoSpeak) {
          speakText(res.opening_message);
        }
      } else {
        setMessages([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    await submitMessage(input);
  }

  async function handleEnd() {
    if (!sessionId) return;
    stopListening();
    stopSpeaking();
    setLoading(true);
    try {
      const res = await api.endSession(sessionId);
      setSummary(res.summary);
      setEnded(true);
      setVoiceMode(false);
    } finally {
      setLoading(false);
    }
  }

  function toggleVoiceMode() {
    const next = !voiceMode;
    setVoiceMode(next);
    if (!next) {
      stopListening();
      stopSpeaking();
      setLiveTranscript("");
    }
  }

  function handleMicClick() {
    if (listening) {
      stopListening();
    } else {
      startListening();
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

        {/* Voice mode toggle on start screen */}
        <div className="flex items-center justify-between mb-6 p-3 bg-gray-900 rounded-lg border border-gray-800">
          <div>
            <div className="text-sm font-medium">Voice Mode</div>
            <div className="text-xs text-gray-500">Talk instead of type, auto-read responses</div>
          </div>
          <button
            onClick={() => { setVoiceMode(!voiceMode); setAutoSpeak(!voiceMode); }}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              voiceMode ? "bg-green-600" : "bg-gray-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                voiceMode ? "translate-x-6" : ""
              }`}
            />
          </button>
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">
            Session #{sessionId}
            <span className="text-gray-500 text-sm font-normal ml-2">
              {sessionType}
            </span>
          </h1>

          {/* Voice status indicators */}
          {listening && (
            <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-900/30 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Listening...
            </span>
          )}
          {speaking && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-900/30 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Speaking...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Voice mode toggle */}
          {!ended && (
            <button
              onClick={toggleVoiceMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                voiceMode
                  ? "bg-green-900/50 text-green-400 border border-green-700"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
              title={voiceMode ? "Disable voice mode" : "Enable voice mode"}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {voiceMode ? "Voice On" : "Voice Off"}
            </button>
          )}

          {/* Auto-speak toggle */}
          {!ended && (
            <button
              onClick={() => { setAutoSpeak(!autoSpeak); if (speaking) stopSpeaking(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                autoSpeak
                  ? "bg-blue-900/50 text-blue-400 border border-blue-700"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
              title={autoSpeak ? "Mute co-founder voice" : "Enable co-founder voice"}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              {autoSpeak ? "Speaker On" : "Speaker Off"}
            </button>
          )}

          {!ended && (
            <button
              onClick={handleEnd}
              className="px-4 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              End Session
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pr-2">
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            role={msg.role}
            content={msg.content}
            modelUsed={msg.modelUsed}
          />
        ))}

        {/* Live transcript preview */}
        {liveTranscript && (
          <div className="flex justify-end mb-4">
            <div className="max-w-[75%] rounded-2xl rounded-br-md px-4 py-3 bg-brand-600/40 text-gray-300 text-sm italic">
              {liveTranscript}...
            </div>
          </div>
        )}

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

      {/* Input area */}
      {!ended && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="mt-4 flex gap-2"
        >
          {/* Mic button */}
          <button
            type="button"
            onClick={handleMicClick}
            disabled={loading}
            className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
              listening
                ? "bg-red-600 hover:bg-red-700 animate-pulse"
                : "bg-gray-800 hover:bg-gray-700 text-gray-400"
            } disabled:opacity-30`}
            title={listening ? "Stop listening" : "Start talking (push to talk)"}
          >
            {listening ? (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "Listening..." : voiceMode ? "Tap mic or type..." : "What's on your mind..."}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 placeholder-gray-600"
            disabled={loading || listening}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || listening}
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
              setVoiceMode(false);
              setAutoSpeak(true);
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
