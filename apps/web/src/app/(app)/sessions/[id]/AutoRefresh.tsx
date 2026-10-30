"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes server data while an assessment is in progress; stops as soon as it is not. */
export function AutoRefresh({ active, intervalMs }: { active: boolean; intervalMs: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}
