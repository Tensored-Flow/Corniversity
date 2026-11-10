"use client";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

export type HelpMode = "question" | "small_hint" | "discuss_approach" | "check_step" | "full_explanation";
export type PanelTab = "tutor" | "notes" | "prerequisites" | "sources";

/** What the learner has selected: a passage of the lesson, or lines of their attempt. */
export interface Selection {
  origin: "lesson" | "attempt";
  text: string;
  lines?: [number, number];
}

interface WorkspaceState {
  selection: Selection | null;
  setSelection: (s: Selection | null) => void;
  tab: PanelTab;
  setTab: (t: PanelTab) => void;
  /** A help request raised elsewhere (the attempt's help buttons); the tutor panel prepares it. */
  helpRequest: { mode: HelpMode; nonce: number } | null;
  requestHelp: (mode: HelpMode) => void;
  /** A note request raised from a lesson selection; the notes panel opens its form. */
  noteRequest: number;
  requestNote: () => void;
  /** Whether the learner has allowed dictation (the browser's speech recognition). */
  voiceAllowed: boolean;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

/**
 * The shared state of one study workspace: what is selected, which context tab is open, and
 * requests passed between the material and the panels. Nothing here is persisted; the server
 * holds the work, the position and the notes.
 */
export function WorkspaceProvider({ children, voiceAllowed = false }: { children: ReactNode; voiceAllowed?: boolean }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [tab, setTabState] = useState<PanelTab>("tutor");
  const [helpRequest, setHelpRequest] = useState<{ mode: HelpMode; nonce: number } | null>(null);
  const [noteRequest, setNoteRequest] = useState(0);
  const reveal = useCallback((t: PanelTab) => {
    setTabState(t);
    // On a phone the panel sits below the material: bring it into view.
    requestAnimationFrame(() => document.getElementById("context-panel")?.scrollIntoView({ block: "start", behavior: "auto" }));
  }, []);
  const value = useMemo<WorkspaceState>(
    () => ({
      selection,
      setSelection,
      tab,
      setTab: setTabState,
      helpRequest,
      requestHelp: (mode) => {
        setHelpRequest({ mode, nonce: Date.now() });
        reveal("tutor");
      },
      noteRequest,
      requestNote: () => {
        setNoteRequest(Date.now());
        reveal("notes");
      },
      voiceAllowed,
    }),
    [selection, tab, helpRequest, noteRequest, reveal, voiceAllowed],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside WorkspaceProvider");
  return ctx;
}
