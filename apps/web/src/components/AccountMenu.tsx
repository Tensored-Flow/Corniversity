"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/** At least 24 px high, so a finger can hit each one on a phone (WCAG 2.5.8). */
const ITEM = "inline-flex min-h-6 items-center whitespace-nowrap text-ink-2 hover:text-ink";

export function AccountMenu({ name }: { name: string }) {
  const router = useRouter();
  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-ink-2 sm:inline">{name}</span>
      <Link href="/operations" className={ITEM}>
        Operations
      </Link>
      <Link href="/settings" className={ITEM}>
        Settings
      </Link>
      <button type="button" onClick={signOut} className={ITEM}>
        Sign out
      </button>
    </div>
  );
}
