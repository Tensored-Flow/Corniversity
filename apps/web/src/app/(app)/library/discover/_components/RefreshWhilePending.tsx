"use client";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

// Whether the page is refreshing itself right now, so the note that says so is never shown when it
// is not (without JavaScript, or after RefreshWhilePending has given up).
let refreshing = false;
const listeners = new Set<() => void>();

function setRefreshing(value: boolean): void {
  refreshing = value;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * While a list is not fetched yet, refreshes the page every few seconds so it appears when the
 * worker has fetched it; gives up after `maxMs` (the list then still says "Not fetched yet" with its
 * "Check again" link, a real navigation that also serves pages without JavaScript).
 */
export function RefreshWhilePending({
  active,
  intervalMs = 4000,
  maxMs = 180_000,
}: {
  active: boolean;
  intervalMs?: number;
  maxMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    setRefreshing(true);
    const id = setInterval(() => {
      if (Date.now() - started > maxMs) {
        clearInterval(id);
        setRefreshing(false);
      } else router.refresh();
    }, intervalMs);
    return () => {
      clearInterval(id);
      setRefreshing(false);
    };
  }, [active, intervalMs, maxMs, router]);
  return null;
}

/** " This page refreshes when the list arrives." only while RefreshWhilePending is refreshing the page. */
export function RefreshingNote() {
  const on = useSyncExternalStore(
    subscribe,
    () => refreshing,
    () => false,
  );
  return on ? <> This page refreshes when the list arrives.</> : null;
}
