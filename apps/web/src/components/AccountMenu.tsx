"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

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
      <Link href="/operations" className="whitespace-nowrap text-ink-2 hover:text-ink">
        Operations
      </Link>
      <Link href="/settings" className="whitespace-nowrap text-ink-2 hover:text-ink">
        Settings
      </Link>
      <button type="button" onClick={signOut} className="whitespace-nowrap text-ink-2 hover:text-ink">
        Sign out
      </button>
    </div>
  );
}
