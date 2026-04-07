"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface Transcript {
  role: "user" | "assistant";
  text: string;
}

export default function CallPage() {
  const [callActive, setCallActive] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [transcript, setTranscript] = useState<Transcript[]>([]);
  const [liveText, setLiveText] = useState("");
  const [duration, setDuration] = useState(0);
  const [summary, setSummary] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const callActiveRef = useRef(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, liveText]);

  useEffect(() => {
    callActiveRef.current = callActive;
  }, [callActive]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function speak(text: string) {
    if (!speakerOn) return;
    return new Promise<void>((resolve) => {
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
    if (!callActiveRef.current || mutedRef.current) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Your browser doesn't support speech recognition. Use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }
      setLiveText(interim);
      if (final.trim()) {
        setLiveText("");
        handleUserSpeech(final.trim());
      }
    };

    recognition.onend = () => {
      setListening(false);
      if (callActiveRef.current && !mutedRef.current) {
        setTimeout(() => startListening(), 300);
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      console.error("Speech recognition error:", e.error);
    };

    recognition.start();
    setListening(true);
  }, []);

  async function handleUserSpeech(text: string) {
    if (!callId || !sessionId) return;
    setTranscript((prev) => [...prev, { role: "user", text }]);
    setProcessing(true);

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const res = await api.voiceMessage(callId, text);
      setTranscript((prev) => [...prev, { role: "assistant", text: res.response }]);

      await speak(res.response);

      if (callActiveRef.current && !mutedRef.current) {
        setTimeout(() => startListening(), 500);
      }
    } catch (e: any) {
      setTranscript((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${e.message}` },
      ]);
      if (callActiveRef.current && !mutedRef.current) {
        setTimeout(() => startListening(), 500);
      }
    } finally {
      setProcessing(false);
    }
  }

  async function startCall() {
    try {
      const res = await api.voiceStart();
      setSessionId(res.session_id);
      setCallId(res.call_id);
      setCallActive(true);
      setTranscript([]);
      setSummary(null);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      setTranscript([{ role: "assistant", text: res.opening_message }]);
      await speak(res.opening_message);
      startListening();
    } catch (e: any) {
      alert(`Failed to start call: ${e.message}`);
    }
  }

  async function endCall() {
    setCallActive(false);
    callActiveRef.current = false;

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    stopSpeaking();
    setListening(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (callId && sessionId) {
      try {
        const res = await api.voiceEnd(callId, sessionId);
        setSummary(res.summary);
      } catch {}
    }
  }

  function toggleMute() {
    const newMuted = !muted;
    setMuted(newMuted);
    if (newMuted) {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      setListening(false);
      setLiveText("");
    } else {
      startListening();
    }
  }

  if (!callActive && !summary) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="w-20 h-20 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Call Your CoFounder</h1>
        <p className="text-gray-400 mb-8 text-sm">
          Talk out loud — like a real call. Your co-founder listens, responds,
          and pushes back. Full transcript saved automatically.
        </p>
        <button
          onClick={startCall}
          className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-full text-lg font-medium transition-colors"
        >
          Start Call
        </button>
      </div>
    );
  }

  if (!callActive && summary) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-4">Call Ended</h1>
        <div className="text-gray-400 text-sm mb-2">
          Duration: {formatTime(duration)}
        </div>
        {summary && (
          <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg mb-6">
            <div className="text-sm text-gray-400 mb-1">Call Summary</div>
            <div className="text-sm">{summary}</div>
          </div>
        )}
        <h2 className="text-lg font-semibold mb-3 text-gray-300">Transcript</h2>
        <div className="space-y-3 mb-8">
          {transcript.map((t, i) => (
            <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                t.role === "user"
                  ? "bg-brand-600 text-white rounded-br-md"
                  : "bg-gray-800 text-gray-100 rounded-bl-md"
              }`}>
                <span className="text-xs text-gray-400 block mb-1">
                  {t.role === "user" ? "You" : "CoFounder"}
                </span>
                {t.text}
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <button
            onClick={() => { setSummary(null); setTranscript([]); setDuration(0); }}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
          >
            Start New Call
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Call header */}
      <div className="text-center py-4 border-b border-gray-800">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium text-red-400">On a call</span>
        </div>
        <div className="text-2xl font-mono">{formatTime(duration)}</div>
        <div className="text-xs text-gray-500 mt-1">
          {speaking
            ? "CoFounder is speaking..."
            : processing
            ? "Thinking..."
            : listening
            ? "Listening..."
            : muted
            ? "Muted"
            : ""}
        </div>
      </div>

      {/* Live transcript */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
        {transcript.map((t, i) => (
          <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"} mb-3`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
              t.role === "user"
                ? "bg-brand-600/80 text-white rounded-br-md"
                : "bg-gray-800 text-gray-100 rounded-bl-md"
            }`}>
              {t.text}
            </div>
          </div>
        ))}
        {liveText && (
          <div className="flex justify-end mb-3">
            <div className="max-w-[75%] rounded-2xl px-4 py-2 text-sm bg-brand-600/40 text-gray-300 rounded-br-md italic">
              {liveText}...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Call controls */}
      <div className="flex items-center justify-center gap-6 py-6 border-t border-gray-800">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            muted ? "bg-red-600" : "bg-gray-700 hover:bg-gray-600"
          }`}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        <button
          onClick={endCall}
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors"
          title="End Call"
        >
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
        </button>

        <button
          onClick={() => setSpeakerOn(!speakerOn)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            !speakerOn ? "bg-yellow-600" : "bg-gray-700 hover:bg-gray-600"
          }`}
          title={speakerOn ? "Speaker Off" : "Speaker On"}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
