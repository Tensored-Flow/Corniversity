import Link from "next/link";
import { DateTime } from "luxon";
import { listJobs } from "@corniversity/db/services/jobs-admin";
import { companionState, listPairings } from "@corniversity/db/services/library";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import { Badge, Button, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { AutoRefresh } from "../../sessions/[id]/AutoRefresh";
import { cancelJobAction, retryJobAction } from "../actions";
import { FlashNotices, LibraryHeader } from "../shared";

export const metadata = { title: "Jobs" };

const TONE: Record<string, "neutral" | "brass" | "moss" | "rust"> = { queued: "brass", active: "brass", completed: "moss", failed: "rust", cancelled: "neutral" };

/**
 * Background jobs: ingestion, assessment, exports and maintenance, each with its idempotency
 * key, progress, result or error. Cancel a queued or running job; retry a failed or cancelled
 * one as a new job whose key is derived from the original.
 */
export default async function JobsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireSession("/library/jobs");
  const { error } = await searchParams;
  const database = db();
  const [jobs, pairings, profile] = await Promise.all([listJobs(database, session.user.id, 80), listPairings(database, session.user.id), ensureProfile(database, session.user.id)]);
  const zone = profile.timezone;
  const when = (d: Date | null) => (d ? DateTime.fromJSDate(d).setZone(zone).toFormat("d LLL HH:mm:ss") : "—");
  const live = jobs.some((j) => j.status === "queued" || j.status === "active");

  return (
    <div className="mx-auto w-full max-w-6xl">
      <AutoRefresh active={live} intervalMs={4000} />
      <LibraryHeader title="Background jobs" lede="Every job carries an idempotency key, so a duplicate delivery or a retry can never grade twice or index twice." active="/library/jobs" sync={companionState(pairings)} />
      <FlashNotices error={error} />
      {jobs.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">No jobs yet.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Progress</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2">Finished</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const assetId = (job.payload as { assetId?: string }).assetId;
                return (
                  <tr key={job.id} className="border-t border-stone align-top">
                    <td className="px-4 py-2">
                      <p className="text-ink">{job.kind}</p>
                      <p className="font-mono text-[0.7rem] text-ink-3">{job.idempotencyKey}</p>
                      {assetId ? (
                        <Link href={`/library/items/${assetId}`} className="text-xs text-brass underline underline-offset-4">
                          item
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={TONE[job.status] ?? "neutral"}>{job.status}</Badge>
                    </td>
                    <td className="px-4 py-2 text-ink-2">
                      {job.progress.stage}
                      {typeof job.progress.percent === "number" ? ` · ${job.progress.percent}%` : ""}
                      {job.error ? <p className="mt-1 max-w-sm text-xs text-rust">{job.error}</p> : null}
                    </td>
                    <td className="px-4 py-2 text-ink-2">{when(job.createdAt)}</td>
                    <td className="px-4 py-2 text-ink-2">{when(job.finishedAt)}</td>
                    <td className="px-4 py-2 text-right">
                      {job.status === "queued" || job.status === "active" ? (
                        <form action={cancelJobAction}>
                          <input type="hidden" name="jobId" value={job.id} />
                          <Button type="submit" variant="danger">
                            Cancel
                          </Button>
                        </form>
                      ) : job.status === "failed" || job.status === "cancelled" ? (
                        <form action={retryJobAction}>
                          <input type="hidden" name="jobId" value={job.id} />
                          <Button type="submit" variant="secondary">
                            Retry
                          </Button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
