"use client";
import { useEffect, useRef, useState } from "react";

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "The microphone was refused, so nothing was heard. Allow it in the browser's site settings to dictate, or type.",
  "service-not-allowed": "This browser does not allow speech recognition here; type instead.",
  network: "The browser's speech service could not be reached, so nothing was transcribed; type instead.",
  "no-speech": "Nothing was heard.",
  "audio-capture": "No microphone was found.",
};

/**
 * Push to dictate with the browser's speech recognition. Recognised text is appended to the
 * learner's own box, where it can be edited before anything is sent; nothing is sent from here.
 * Hidden unless the learner has allowed dictation and the browser offers recognition.
 */
export function DictationButton({
  allowed,
  onText,
  label = "Dictate",
  disabled = false,
}: {
  allowed: boolean;
  onText: (text: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const deliver = useRef(onText);
  deliver.current = onText;

  useEffect(() => {
    setSupported(Boolean(recognitionCtor()));
    return () => recognition.current?.abort();
  }, []);

  if (!allowed || !supported) return null;

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = document.documentElement.lang || "en-GB";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let finalText = "";
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (!result) continue;
        if (result.isFinal) finalText += result[0].transcript;
        else pending += result[0].transcript;
      }
      if (finalText.trim()) deliver.current(finalText.trim());
      setInterim(pending);
    };
    r.onerror = (e) => setError(ERRORS[e.error] ?? `Dictation stopped (${e.error}).`);
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    recognition.current = r;
    setError(null);
    r.start();
    setListening(true);
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={listening}
        disabled={disabled}
        onClick={() => (listening ? recognition.current?.stop() : start())}
        className="rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-1 text-sm text-ink hover:bg-paper-3 disabled:opacity-60 aria-pressed:border-brass aria-pressed:bg-brass-soft"
      >
        {listening ? "Stop dictation" : label}
      </button>
      {listening ? (
        <span role="status" className="text-xs text-ink-2">
          Listening{interim ? `: ${interim}` : "…"}
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-rust">
          {error}
        </span>
      ) : null}
    </span>
  );
}
