import type { ReactNode } from "react";
import { requireSession } from "@/lib/session";

/**
 * The reading room's own frame: the full height of the window without the app's navigation, so
 * the pages scroll inside the reader instead of fighting the page. Signed-in only, like the app;
 * the theme and the "Skip to content" link come from the root layout and land on this main.
 */
export default async function ReaderLayout({ children }: { children: ReactNode }) {
  await requireSession();
  return (
    <main id="main" className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      {children}
    </main>
  );
}
