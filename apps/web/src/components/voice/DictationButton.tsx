"use client";
import { useCallback, useEffect, useRef, useState } from "react";

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
 * Stop finishes transcribing what was heard; Cancel stops capture at once and drops speech not
 * yet transcribed. Capture also stops the moment the box is disabled (a message being sent or an
 * attempt submitted). Offered only after the learner allowed dictation; a browser without
 * recognition says so, and typing always works.
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
  // null until mounted, so the server render and the first client render agree.
  const [supported, setSupported] = useState<boolean | null>(null);
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

  /** Stops capture now; anything heard but not yet transcribed is dropped. */
  const cancel = useCallback(() => {
    const r = recognition.current;
    recognition.current = null;
    r?.abort();
    setListening(false);
    setInterim("");
  }, []);

  useEffect(() => {
    if (disabled || !allowed) cancel();
  }, [disabled, allowed, cancel]);

  if (!allowed || supported === null) return null;
  if (!supported) {
    return (
      <span className="text-xs text-ink-3" data-testid="dictation-unavailable">
        Dictation is not available in this browser; type instead.
      </span>
    );
  }

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    // Only one recogniser at a time: an earlier one still finishing is ended first.
    cancel();
    const r = new Ctor();
    r.lang = document.documentElement.lang || "en-GB";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      if (recognition.current !== r) return;
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
    // Events from a recogniser that was cancelled or replaced are ignored.
    r.onerror = (e) => {
      if (recognition.current !== r) return;
      if (e.error !== "aborted") setError(ERRORS[e.error] ?? `Dictation stopped (${e.error}).`);
    };
    r.onend = () => {
      if (recognition.current !== r) return;
      recognition.current = null;
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
        <>
          <button
            type="button"
            onClick={cancel}
            className="rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-1 text-sm text-ink hover:bg-paper-3"
          >
            Cancel
          </button>
          <span role="status" className="text-xs text-ink-2">
            Listening{interim ? `: ${interim}` : "…"}
          </span>
        </>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-rust">
          {error}
        </span>
      ) : null}
    </span>
  );
}
