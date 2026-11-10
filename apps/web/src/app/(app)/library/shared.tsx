import type { AssetStatus } from "@corniversity/db/schema/library";
import type { AssetRow, ProcessingAction } from "@corniversity/db/services/library";
import Link from "next/link";
import { Badge, Notice } from "@/components/ui";
import { errorNotice } from "@/lib/notices";

export const TABS = [
  { href: "/library", label: "Shelf" },
  { href: "/library/sources", label: "Sources" },
  { href: "/library/requests", label: "Books to obtain" },
  { href: "/library/upload", label: "Upload" },
  { href: "/library/sync", label: "Desktop sync" },
  { href: "/library/jobs", label: "Jobs" },
] as const;

export type SyncState = "online" | "paused" | "offline";

const SYNC_LABEL: Record<SyncState, { label: string; tone: "moss" | "brass" | "neutral"; help: string }> = {
  online: {
    label: "Desktop sync online",
    tone: "moss",
    help: "The companion on your computer sent a heartbeat in the last two minutes and is watching the inbox.",
  },
  paused: {
    label: "Desktop sync paused",
    tone: "brass",
    help: "The companion is running but paused; nothing is registered or uploaded until you resume it.",
  },
  offline: {
    label: "Desktop sync offline",
    tone: "neutral",
    help: "No companion is running. Files on your desktop are not being watched; items already stored here remain usable.",
  },
};

export function SyncBadge({ state }: { state: SyncState }) {
  const meta = SYNC_LABEL[state];
  return (
    <Badge tone={meta.tone} title={meta.help}>
      {meta.label}
    </Badge>
  );
}

export function LibraryHeader({ title, lede, active, sync }: { title: string; lede?: string; active: string; sync: SyncState }) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-brass">Library</p>
          <h1 className="mt-1 text-3xl text-ink">{title}</h1>
        </div>
        <SyncBadge state={sync} />
      </div>
      {lede ? <p className="mt-2 max-w-prose text-sm text-ink-2">{lede}</p> : null}
      <nav aria-label="Library sections" className="mt-4 flex gap-1 overflow-x-auto border-b border-stone">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.href === active ? "page" : undefined}
            className={[
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm",
              tab.href === active ? "border-brass font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export const ASSET_STATUS: Record<AssetStatus, { label: string; tone: "neutral" | "brass" | "moss" | "rust" | "slate"; help: string }> = {
  registered_local: {
    label: "On your desktop",
    tone: "slate",
    help: "Registered by the companion. Only its name, size, checksum and PDF metadata have left your device.",
  },
  upload_requested: {
    label: "Waiting for upload",
    tone: "brass",
    help: "You granted private storage; the companion sends the file on its next sync.",
  },
  quarantined: { label: "Quarantined", tone: "brass", help: "Received and validated. Confirm what it is before anything else happens." },
  validated: { label: "Confirmed", tone: "neutral", help: "Metadata confirmed. Text is extracted only when you allow it." },
  processing: { label: "Processing", tone: "brass", help: "Text is being extracted and indexed." },
  processed: {
    label: "Ready",
    tone: "moss",
    help: "Indexed: readable and searchable. Tutors see passages only if you allow external AI processing.",
  },
  rejected: { label: "Rejected", tone: "rust", help: "The file could not be processed; the reason is on the item page." },
  deleted: { label: "Deleted", tone: "neutral", help: "Removed." },
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const meta = ASSET_STATUS[status];
  return (
    <Badge tone={meta.tone} title={meta.help}>
      {meta.label}
    </Badge>
  );
}

export function assetTitle(asset: AssetRow): string {
  return asset.confirmedTitle ?? asset.candidateMetadata.title ?? asset.filename;
}

export const PERMISSIONS: { action: ProcessingAction; label: string; explain: string }[] = [
  { action: "local_read", label: "Read here", explain: "Open the item in the reading room on this installation." },
  {
    action: "local_extract",
    label: "Extract and index the text",
    explain: "Needed for page text, search and exact citations. Runs on this installation; nothing leaves it.",
  },
  {
    action: "private_cloud_store",
    label: "Store a private copy",
    explain:
      "Keep the original on the university server (in local mode: on this machine). Required before a desktop file can be processed.",
  },
  {
    action: "external_ai",
    label: "Let tutors read passages",
    explain: "Permitted passages may be sent to the configured model provider when a tutor cites or explains them.",
  },
  {
    action: "external_embedding",
    label: "Generate embeddings externally",
    explain: "Send passages to an embedding service for semantic retrieval. Off unless the licence allows derived processing.",
  },
  { action: "share", label: "Sharing and export", explain: "Include this item's text in exports. Normally off for third-party books." },
];

export function PermissionSummary({
  permissions,
}: {
  permissions: Record<ProcessingAction, { status: "unknown" | "allowed" | "denied" }>;
}) {
  const allowed = PERMISSIONS.filter((p) => permissions[p.action].status === "allowed").map((p) => p.label);
  return (
    <span className="text-xs text-ink-3">
      {allowed.length ? `Allowed: ${allowed.join(", ")}` : "Reference only: no processing permitted yet"}
    </span>
  );
}

export function FlashNotices({ error, saved, written }: { error?: string; saved?: string; written?: string }) {
  const savedText: Record<string, string> = {
    metadata: "Metadata saved.",
    permission: "Permission recorded.",
    processing: "Extraction queued. Progress appears below.",
    imported: "Imported and queued for extraction under the licence recorded in the source registry.",
    duplicate: "That file was already in your library; nothing was stored twice.",
    note: "Note saved.",
    "1": "Saved.",
  };
  return (
    <div className="mb-4 flex flex-col gap-2">
      {error ? <Notice tone="rust">{errorNotice(error)}</Notice> : null}
      {saved ? <Notice tone="moss">{savedText[saved] ?? "Saved."}</Notice> : null}
      {written ? <Notice tone="moss">Written to {written} (requests.md and requests.json).</Notice> : null}
    </div>
  );
}
