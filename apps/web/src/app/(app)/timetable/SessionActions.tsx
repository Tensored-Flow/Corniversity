"use client";
import { useState } from "react";
import { moveSessionAction, setSessionStatusAction, toggleLockAction } from "./actions";

/** Per-session controls with a keyboard-friendly move form instead of drag-and-drop. */
export function SessionActions({ sessionId, status, locked, startsAtIso }: { sessionId: string; status: string; locked: boolean; startsAtIso: string }) {
  const [moving, setMoving] = useState(false);
  if (status === "cancelled" || status === "completed") return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1 text-[0.7rem]">
      <form action={setSessionStatusAction}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <button type="submit" name="status" value="completed" className="rounded border border-stone px-1.5 py-0.5 text-moss hover:bg-moss-soft">Done</button>
      </form>
      <form action={setSessionStatusAction}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <button type="submit" name="status" value="attempted" className="rounded border border-stone px-1.5 py-0.5 text-ink-2 hover:bg-paper-3">Attempted</button>
      </form>
      {!locked ? (
        <button type="button" onClick={() => setMoving((m) => !m)} className="rounded border border-stone px-1.5 py-0.5 text-ink-2 hover:bg-paper-3">
          Move
        </button>
      ) : null}
      <form action={toggleLockAction}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="locked" value={locked ? "0" : "1"} />
        <button type="submit" className="rounded border border-stone px-1.5 py-0.5 text-ink-2 hover:bg-paper-3">{locked ? "Unlock" : "Lock"}</button>
      </form>
      <form action={setSessionStatusAction}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <button type="submit" name="status" value="cancelled" className="rounded border border-stone px-1.5 py-0.5 text-rust hover:bg-rust-soft">Cancel</button>
      </form>
      {moving ? (
        <form action={moveSessionAction} className="mt-1 flex w-full flex-wrap items-center gap-1">
          <input type="hidden" name="sessionId" value={sessionId} />
          <label className="sr-only" htmlFor={`move-${sessionId}`}>New start time</label>
          <input id={`move-${sessionId}`} type="datetime-local" name="newStart" defaultValue={startsAtIso} step={900} className="rounded border border-stone-2 bg-paper px-1 py-0.5 text-xs" />
          <button type="submit" className="rounded bg-brass px-1.5 py-0.5 text-paper-2">Apply</button>
        </form>
      ) : null}
    </div>
  );
}
