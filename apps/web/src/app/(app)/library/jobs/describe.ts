import { normaliseDoi, parseArxivId, subjectBySlug } from "@corniversity/core";

/**
 * What a background job does, in words, for the Jobs page. It is built from the job's kind and the
 * parts of its payload that name the work (a task, an arXiv id, subjects, an export's format), never
 * from its idempotency key, which can carry the owner's account id. Payload values are read as data:
 * an arXiv id or a subject slug appears only when it has the expected shape.
 */
export interface JobDescription {
  /** One plain sentence: what the job does. */
  text: string;
  /** The paper the job is about, for a link to its page. */
  workId: string | null;
  /** The file the job is about, for a link to its item. */
  assetId: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ARXIV_CATEGORY = /^[a-z-]+(?:\.[A-Za-z-]+|\.\*)?$/;

const EXPORTS: Record<string, string> = {
  full: "Build the full records export",
  notebook: "Build the notebook export",
  records: "Build the records export",
  alter_markdown: "Build the Markdown export",
};

const MAINTENANCE: Record<string, string> = {
  "revision-due": "Maintenance: mark revision items that are due",
  "revoke-stale-pairing-codes": "Maintenance: revoke expired pairing codes",
  "expire-old-exports": "Maintenance: remove expired exports",
  "unsettle-stale-runs": "Maintenance: release model runs left unsettled",
  "purge-provider-cache": "Maintenance: purge expired provider responses",
};

function field(payload: unknown, key: string): unknown {
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>)[key] : undefined;
}

function idField(payload: unknown, key: string): string | null {
  const value = field(payload, key);
  return typeof value === "string" && UUID.test(value) ? value : null;
}

function subjectNames(payload: unknown): string[] {
  const subjects = field(payload, "subjects");
  if (!Array.isArray(subjects)) return [];
  return subjects
    .filter((s): s is string => typeof s === "string")
    .map((slug) => subjectBySlug(slug)?.name)
    .filter((name): name is string => Boolean(name));
}

export function describeJob(kind: string, payload: unknown): JobDescription {
  const task = field(payload, "task");
  const workId = idField(payload, "workId");
  const assetId = idField(payload, "assetId");
  const base = { workId, assetId };
  switch (kind) {
    case "ingest-asset":
      return { ...base, text: "Extract and index the text of a file" };
    case "assess-submission":
      return { ...base, text: "Assess a submitted attempt" };
    case "transcribe-pages":
      return { ...base, text: "Transcribe pages of paper work" };
    case "prepare-course":
      return { ...base, text: "Prepare a course" };
    case "prepare-unit":
      return { ...base, text: "Prepare a unit" };
    case "export-records": {
      const format = field(payload, "kind");
      return { ...base, text: (typeof format === "string" && EXPORTS[format]) || "Build an export" };
    }
    case "maintenance":
      return { ...base, text: (typeof task === "string" && MAINTENANCE[task]) || "Maintenance" };
    case "scholarly-arxiv": {
      if (task === "record") {
        const arxivId = field(payload, "arxivId");
        return {
          ...base,
          text:
            typeof arxivId === "string" && parseArxivId(arxivId)?.id === arxivId
              ? `Fetch arXiv's record of arXiv:${arxivId}`
              : "Fetch a paper's arXiv record",
        };
      }
      if (task === "private-copy") return { ...base, text: "Keep a private copy of an arXiv version" };
      if (task === "listing") {
        const categories = field(payload, "categories");
        const named = Array.isArray(categories)
          ? categories.filter((c): c is string => typeof c === "string" && ARXIV_CATEGORY.test(c)).slice(0, 6)
          : [];
        return {
          ...base,
          text: named.length ? `Fetch the newest arXiv submissions in ${named.join(", ")}` : "Fetch the newest arXiv submissions",
        };
      }
      return { ...base, text: "An arXiv request" };
    }
    case "scholarly-refresh":
      return {
        ...base,
        text:
          task === "integrity"
            ? "Check Crossref for corrections and retractions of a paper"
            : "Refresh a paper's details from OpenAlex and check Crossref for corrections and retractions",
      };
    case "scholarly-lists": {
      const names = subjectNames(payload);
      return {
        ...base,
        text: names.length ? `Fetch Discover's lists for ${names.join(", ")}` : "Fetch Discover's lists for every chosen subject",
      };
    }
    default:
      return { ...base, text: "A background job" };
  }
}

/**
 * The Progress column: a queued or running job's stage and percentage; a finished job never shows the
 * last stage it reported (a completed job read "applying · 80%"). A completed Crossref check that had
 * no recorded response in fixture mode says so, by the DOIs in its result (each a valid DOI, read as
 * data); otherwise a finished job's column is empty (a failed one shows its error beside it).
 */
export function jobProgress(job: {
  kind: string;
  status: string;
  progress: { stage?: unknown; percent?: unknown } | null;
  result: unknown;
}): string | null {
  if (job.status === "queued" || job.status === "active") {
    const stage = typeof job.progress?.stage === "string" ? job.progress.stage : job.status;
    return typeof job.progress?.percent === "number" ? `${stage} · ${job.progress.percent}%` : stage;
  }
  if (job.status !== "completed" || job.kind !== "scholarly-refresh") return null;
  const list = field(job.result, "unrecorded");
  const dois = Array.isArray(list) ? list.filter((d): d is string => typeof d === "string" && normaliseDoi(d) === d).slice(0, 5) : [];
  if (dois.length === 0) return null;
  return `Crossref's check not made: no recorded response in fixture mode for ${dois.length === 1 ? "DOI" : "DOIs"} ${dois.join(", ")}.`;
}
