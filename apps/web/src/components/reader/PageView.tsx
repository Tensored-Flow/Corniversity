"use client";
import dynamic from "next/dynamic";
import type { PdfReaderProps } from "./PdfReader";

// PDF.js runs only in the browser: the viewer is never rendered on the server.
const PdfReader = dynamic(() => import("./PdfReader"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-paper-3 p-6">
      <p role="status" className="text-sm text-ink-2">
        Loading the reader…
      </p>
    </div>
  ),
});

export function PageView(props: PdfReaderProps) {
  return <PdfReader {...props} />;
}
