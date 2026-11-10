"use client";
import type { ReactNode } from "react";
import { type PanelTab, useWorkspace } from "./Workspace";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "tutor", label: "Tutor" },
  { id: "notes", label: "Notes" },
  { id: "prerequisites", label: "Prerequisites" },
  { id: "sources", label: "Sources" },
];

/**
 * One context panel beside the material, with tabs instead of stacked columns. On a phone it sits
 * below the material at full width. Every tab stays mounted, so a half-written message or note
 * survives switching tabs.
 */
export function ContextPanel({ panels, counts }: { panels: Record<PanelTab, ReactNode>; counts?: Partial<Record<PanelTab, number>> }) {
  const { tab, setTab } = useWorkspace();
  return (
    <section id="context-panel" aria-label="Study context" className="rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-4">
      <div role="tablist" aria-label="Context" className="flex flex-wrap gap-1 border-b border-stone pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={[
              "rounded-[var(--radius-control)] px-2.5 py-1 text-sm",
              tab === t.id ? "bg-brass-soft text-brass-strong" : "text-ink-2 hover:text-ink",
            ].join(" ")}
          >
            {t.label}
            {counts?.[t.id] ? <span className="ml-1 text-xs text-ink-3">({counts[t.id]})</span> : null}
          </button>
        ))}
      </div>
      {TABS.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={tab !== t.id} className="pt-3">
          {panels[t.id]}
        </div>
      ))}
    </section>
  );
}
