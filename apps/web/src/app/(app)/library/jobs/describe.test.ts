import { describe, expect, it } from "vitest";
import { describeJob, jobProgress } from "./describe";

const OWNER = "owner-account-id-7f3a";
const WORK = "11111111-1111-4111-8111-111111111111";
const ASSET = "22222222-2222-4222-8222-222222222222";

describe("describeJob (the Jobs page)", () => {
  it("says what each job does, from its kind and payload, never from its idempotency key", () => {
    const cases: [string, Record<string, unknown>, string][] = [
      ["ingest-asset", { assetId: ASSET }, "Extract and index the text of a file"],
      ["export-records", { kind: "notebook" }, "Build the notebook export"],
      ["maintenance", { task: "purge-provider-cache" }, "Maintenance: purge expired provider responses"],
      ["scholarly-arxiv", { task: "record", workId: WORK, arxivId: "2305.18290" }, "Fetch arXiv's record of arXiv:2305.18290"],
      ["scholarly-arxiv", { task: "record", workId: WORK, arxivId: "hep-th/9711200" }, "Fetch arXiv's record of arXiv:hep-th/9711200"],
      ["scholarly-arxiv", { task: "private-copy", assetId: ASSET }, "Keep a private copy of an arXiv version"],
      ["scholarly-arxiv", { task: "listing", categories: ["math.*", "hep-th"] }, "Fetch the newest arXiv submissions in math.*, hep-th"],
      ["scholarly-refresh", { task: "integrity", workId: WORK }, "Check Crossref for corrections and retractions of a paper"],
      [
        "scholarly-lists",
        { task: "subject-lists", subjects: ["mathematics", "physics"] },
        "Fetch Discover's lists for Mathematics, Physics",
      ],
      ["scholarly-lists", { task: "subject-lists" }, "Fetch Discover's lists for every chosen subject"],
      ["something-new", {}, "A background job"],
    ];
    for (const [kind, payload, text] of cases) {
      const described = describeJob(kind, { idempotencyKey: `discover:${OWNER}:x`, ownerId: OWNER, ...payload });
      expect(described.text, kind).toBe(text);
      expect(described.text, kind).not.toContain(OWNER);
    }
  });

  it("links the paper or file a job is about, and reads payload values only in their expected shape", () => {
    expect(describeJob("scholarly-refresh", { task: "work", workId: WORK })).toMatchObject({ workId: WORK, assetId: null });
    expect(describeJob("ingest-asset", { assetId: ASSET })).toMatchObject({ workId: null, assetId: ASSET });
    expect(describeJob("ingest-asset", { assetId: "../../etc" })).toMatchObject({ assetId: null });
    expect(describeJob("scholarly-arxiv", { task: "record", arxivId: "<b>x</b>" }).text).toBe("Fetch a paper's arXiv record");
    expect(describeJob("scholarly-arxiv", { task: "listing", categories: ["<script>"] }).text).toBe("Fetch the newest arXiv submissions");
    expect(describeJob("scholarly-lists", { subjects: ["not-a-subject"] }).text).toBe("Fetch Discover's lists for every chosen subject");
    expect(describeJob("export-records", null).text).toBe("Build an export");
  });

  it("shows a running job's stage, never a finished job's last stage, and a fixture-mode check that could not be made", () => {
    const refresh = { kind: "scholarly-refresh", progress: { stage: "applying", percent: 80 } };
    expect(jobProgress({ ...refresh, status: "active", result: null })).toBe("applying · 80%");
    expect(jobProgress({ kind: "ingest-asset", status: "queued", progress: { stage: "queued" }, result: null })).toBe("queued");
    for (const status of ["completed", "failed", "cancelled"])
      expect(jobProgress({ ...refresh, status, result: { unrecorded: [] } }), status).toBeNull();
    expect(jobProgress({ ...refresh, status: "completed", result: { unrecorded: ["10.1063/1.464913"] } })).toBe(
      "Crossref's check not made: no recorded response in fixture mode for DOI 10.1063/1.464913.",
    );
    // Result values are data: only valid DOIs are named.
    expect(jobProgress({ ...refresh, status: "completed", result: { unrecorded: ["<b>x</b>", 7] } })).toBeNull();
  });
});
