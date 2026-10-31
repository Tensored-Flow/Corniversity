import { getEnv } from "@corniversity/db/env";
import { companionState, listAssets, listPairings } from "@corniversity/db/services/library";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { DateTime } from "luxon";
import { Badge, Button, Card, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { revokePairingAction } from "../actions";
import { LibraryHeader } from "../shared";
import { PairingCode } from "./PairingCode";

export const metadata = { title: "Desktop sync" };

/**
 * Desktop sync: pair the companion, see every paired device with its roots and last contact,
 * revoke one, and see exactly what the university is waiting for. The offline state is shown
 * plainly; it is not an error.
 */
export default async function SyncPage() {
  const session = await requireSession("/library/sync");
  const database = db();
  const [pairings, assets, profile] = await Promise.all([
    listPairings(database, session.user.id),
    listAssets(database, session.user.id),
    ensureProfile(database, session.user.id),
  ]);
  const env = getEnv();
  const state = companionState(pairings);
  const waiting = assets.filter((a) => a.status === "upload_requested");
  const localOnly = assets.filter((a) => a.status === "registered_local");
  const zone = profile.timezone;
  const when = (d: Date | null) => (d ? DateTime.fromJSDate(d).setZone(zone).toFormat("d LLL HH:mm") : "never");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <LibraryHeader
        title="Desktop sync"
        lede="A deployed server cannot see a folder on your computer. The companion can: it registers what is in your library inbox and sends a file only after you grant private storage for that item. It talks outwards over HTTPS; nothing listens on your machine, and nothing starts at login unless you set that up."
        active="/library/sync"
        sync={state}
      />

      {state === "offline" ? (
        <div className="mb-6">
          <Notice tone="neutral" title="Desktop sync is offline">
            No companion has reported in the last two minutes. Files on your desktop are not being watched. Everything already stored here
            remains usable.
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card as="section" aria-labelledby="pair-heading">
          <h2 id="pair-heading" className="text-lg text-ink">
            Pair a computer
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            The code is exchanged once for a narrow device token. Revoke it here at any time; the companion stops on its next request.
          </p>
          <div className="mt-4">
            <PairingCode server={env.BETTER_AUTH_URL} />
          </div>
          <h3 className="mt-6 text-sm font-medium text-ink">Then, on that computer</h3>
          <pre
            // biome-ignore lint/a11y/noNoninteractiveTabindex: the block scrolls sideways and must be reachable by keyboard (axe: scrollable-region-focusable)
            tabIndex={0}
            className="mt-1 overflow-x-auto rounded bg-paper p-3 font-mono text-xs text-ink"
          >{`pnpm library:sync -- --dry-run   # what would be registered (nothing sent)
pnpm library:sync                # register files; send permitted uploads
pnpm library:watch               # keep watching; Ctrl+C stops
pnpm library:status`}</pre>
          <p className="mt-2 text-xs text-ink-3">Requires Node 22+. No Docker, WSL or admin rights. Details in apps/companion/README.md.</p>
        </Card>

        <Card as="section" aria-labelledby="folders-heading">
          <h2 id="folders-heading" className="text-lg text-ink">
            Folder layout
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Pairing creates this under your library root (default: your data root, outside the repository). Only the inbox is watched.
          </p>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: the block scrolls sideways and must be reachable by keyboard (axe: scrollable-region-focusable) */}
          <pre tabIndex={0} className="mt-2 overflow-x-auto rounded bg-paper p-3 font-mono text-xs text-ink">{`<root>/
  inbox/
    mathematics/  physics/  chemistry/
    computer-science-ai/  neuroscience/  cognitive-science/
  originals/  processed/  exports/  requests/  quarantine/`}</pre>
          <p className="mt-2 text-xs text-ink-3">
            Course subfolders are optional; a file can support several courses without duplicate copies. Files need not be renamed.
            Temporary files, hidden files and symbolic links are ignored.
          </p>
        </Card>

        <Card as="section" aria-labelledby="devices-heading" className="lg:col-span-2">
          <h2 id="devices-heading" className="text-lg text-ink">
            Paired computers
          </h2>
          {pairings.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">None yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
                  <tr>
                    <th className="py-1 pr-3">Device</th>
                    <th className="py-1 pr-3">Roots</th>
                    <th className="py-1 pr-3">Paired</th>
                    <th className="py-1 pr-3">Last contact</th>
                    <th className="py-1 pr-3">State</th>
                    <th className="py-1" />
                  </tr>
                </thead>
                <tbody>
                  {pairings.map((p) => {
                    const recent = p.lastSeenAt && Date.now() - p.lastSeenAt.getTime() < 2 * 60_000;
                    return (
                      <tr key={p.id} className="border-t border-stone align-top">
                        <td className="py-2 pr-3 text-ink">{p.name}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-ink-2">{p.roots.join(", ") || "—"}</td>
                        <td className="py-2 pr-3 text-ink-2">{when(p.createdAt)}</td>
                        <td className="py-2 pr-3 text-ink-2">
                          {when(p.lastSeenAt)}
                          {p.lastStatus ? ` · v${p.lastStatus.version}` : ""}
                        </td>
                        <td className="py-2 pr-3">
                          {p.revokedAt ? (
                            <Badge tone="neutral">revoked</Badge>
                          ) : recent && p.lastStatus?.watching ? (
                            <Badge tone="moss">watching</Badge>
                          ) : recent && p.lastStatus?.paused ? (
                            <Badge tone="brass">paused</Badge>
                          ) : (
                            <Badge tone="neutral">offline</Badge>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {!p.revokedAt ? (
                            <form action={revokePairingAction}>
                              <input type="hidden" name="pairingId" value={p.id} />
                              <Button type="submit" variant="danger">
                                Revoke
                              </Button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card as="section" aria-labelledby="waiting-heading">
          <h2 id="waiting-heading" className="text-lg text-ink">
            Waiting for the companion
          </h2>
          <p className="mt-1 text-sm text-ink-2">Items you granted private storage for; the next sync or heartbeat sends them.</p>
          {waiting.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">Nothing is waiting.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {waiting.map((a) => (
                <li key={a.id} className="text-ink">
                  {a.confirmedTitle ?? a.candidateMetadata.title ?? a.filename}{" "}
                  <span className="break-all font-mono text-xs text-ink-3">{a.localPathHint}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card as="section" aria-labelledby="local-heading">
          <h2 id="local-heading" className="text-lg text-ink">
            On your desktop only
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Registered, reference-only. Nothing but title, size, checksum and PDF metadata has left the device.
          </p>
          {localOnly.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">None.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {localOnly.map((a) => (
                <li key={a.id} className="text-ink">
                  <a href={`/library/items/${a.id}`} className="text-brass underline underline-offset-4">
                    {a.confirmedTitle ?? a.candidateMetadata.title ?? a.filename}
                  </a>{" "}
                  <span className="break-all font-mono text-xs text-ink-3">{a.localPathHint}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
