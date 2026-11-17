"use client";
import { type ReactNode, useEffect, useState } from "react";
import { ReadAloud } from "@/components/voice/ReadAloud";

export interface PlayerScene {
  id: string;
  title: string;
  caption: string;
  durationSeconds: number;
  /** Equations and plot, rendered on the server. */
  body: ReactNode;
}

/**
 * The storyboard, one scene at a time. Nothing moves unless the learner presses Play; then each
 * scene stays for its stated duration. The caption is always shown as text.
 */
export function VisualPlayer({ title, scenes }: { title: string; scenes: PlayerScene[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const scene = scenes[index];

  useEffect(() => {
    if (!playing || !scene) return;
    const t = setTimeout(() => {
      if (index < scenes.length - 1) setIndex(index + 1);
      else setPlaying(false);
    }, scene.durationSeconds * 1000);
    return () => clearTimeout(t);
  }, [playing, index, scene, scenes.length]);

  if (!scene) return null;
  const button =
    "rounded-[var(--radius-control)] border border-stone-2 bg-paper px-3 py-1 text-sm text-ink hover:bg-paper-3 disabled:opacity-50";
  return (
    <section
      aria-roledescription="storyboard"
      aria-label={title}
      className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4"
    >
      <ol className="flex flex-wrap gap-2 text-xs" aria-label="Scenes">
        {scenes.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              aria-current={i === index ? "step" : undefined}
              onClick={() => {
                setPlaying(false);
                setIndex(i);
              }}
              className={[
                "rounded-[var(--radius-control)] border px-2 py-1",
                i === index ? "border-brass bg-brass-soft text-brass-strong" : "border-stone bg-paper text-ink-2",
              ].join(" ")}
            >
              {i + 1}. {s.title}
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-4" aria-live={playing ? "off" : "polite"}>
        <h2 className="text-xl text-ink">
          <span className="text-ink-3">
            {index + 1}/{scenes.length}
          </span>{" "}
          {scene.title}
        </h2>
        <section
          aria-label={`${scene.title} diagram`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the diagram scrolls sideways and must be reachable by keyboard (axe: scrollable-region-focusable)
          tabIndex={0}
          className="mt-3 overflow-x-auto focus-visible:outline-2 focus-visible:outline-focus"
        >
          {scene.body}
        </section>
        <p className="mt-3 max-w-prose text-base text-ink" data-testid="scene-caption">
          {scene.caption}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={button}
          disabled={index === 0}
          onClick={() => {
            setPlaying(false);
            setIndex(index - 1);
          }}
        >
          Previous
        </button>
        <button type="button" className={button} onClick={() => setPlaying(!playing)}>
          {playing ? "Pause" : index === scenes.length - 1 ? "Play from here" : "Play"}
        </button>
        <button
          type="button"
          className={button}
          disabled={index === scenes.length - 1}
          onClick={() => {
            setPlaying(false);
            setIndex(index + 1);
          }}
        >
          Next
        </button>
        <span className="text-xs text-ink-3">{scene.durationSeconds} s when playing</span>
        <ReadAloud text={`${scene.title}. ${scene.caption}`} label="Read caption aloud" />
      </div>
    </section>
  );
}
