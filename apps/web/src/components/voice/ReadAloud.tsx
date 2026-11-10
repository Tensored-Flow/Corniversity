"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Reads text aloud with an on-device voice only (`localService`), so the text never leaves the
 * device. With no such voice the control says so rather than falling back to a network voice.
 */
export function ReadAloud({ text, label = "Read aloud" }: { text: string; label?: string }) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null | undefined>(undefined);
  const [state, setState] = useState<"idle" | "speaking" | "paused">("idle");
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setVoice(null);
      return;
    }
    const pick = () => {
      const local = window.speechSynthesis.getVoices().filter((v) => v.localService);
      const lang = document.documentElement.lang || "en";
      setVoice(local.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())) ?? local[0] ?? null);
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", pick);
      if (utterance.current) window.speechSynthesis.cancel();
    };
  }, []);

  if (voice === undefined) return null;
  if (voice === null) {
    // Said in text, not a tooltip on a disabled control, so keyboard and screen-reader users get it too.
    return (
      <span className="text-xs text-ink-3">{label}: no on-device voice in this browser, and text is never sent to a network voice.</span>
    );
  }

  function speak() {
    if (!voice) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    utterance.current = u;
    window.speechSynthesis.speak(u);
    setState("speaking");
  }

  const small = "rounded-[var(--radius-control)] border border-stone-2 bg-paper px-2 py-0.5 text-xs text-ink hover:bg-paper-3";
  return (
    <span className="inline-flex items-center gap-1">
      {state === "idle" ? (
        <button type="button" onClick={speak} className={small}>
          {label}
        </button>
      ) : (
        <>
          <button
            type="button"
            className={small}
            onClick={() => {
              if (state === "speaking") {
                window.speechSynthesis.pause();
                setState("paused");
              } else {
                window.speechSynthesis.resume();
                setState("speaking");
              }
            }}
          >
            {state === "speaking" ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            className={small}
            onClick={() => {
              window.speechSynthesis.cancel();
              setState("idle");
            }}
          >
            Stop
          </button>
        </>
      )}
    </span>
  );
}
