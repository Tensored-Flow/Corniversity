import type { RoleName } from "../provider";

/**
 * Role contracts (adapted from ALTER's adviser/librarian/tutor/editor/roommate structure and
 * extended). A contract is enforced outside the prompt: the application only exposes the listed
 * server functions to a role, never a generic tool. Versions are recorded on provider runs.
 */
export interface RoleContract {
  role: RoleName;
  version: string;
  purpose: string;
  allowedTools: readonly string[];
  requiredContext: readonly string[];
  forbidden: readonly string[];
  outputSchema: "prose" | "AssessorFeedback" | "ProgrammeDraft" | "SourceMetadataGuess" | "SessionSummary";
  memoryPolicy: string;
  escalation: string;
  /**
   * The output allowance includes thinking, which current models cannot switch off; `effort` sets
   * thinking depth explicitly per role; `maxRunUsd` is the role's own ceiling on a run's worst case,
   * sized for the strict prompt bound (a token per byte): on Claude Opus 5.5 with fallback a run's
   * worst case is about prompt-bytes x $11.25/M + output x $51.25/M, so each ceiling admits the
   * role's output allowance with the prompt it normally carries. The owner's limits apply as well.
   */
  limits: { maxOutputTokens: number; maxRunUsd: number; effort: "low" | "medium" | "high" };
}

export const ROLE_CONTRACTS: Record<RoleName, RoleContract> = {
  director: {
    role: "director",
    version: "1.1",
    purpose: "Maintain the learner's programme, goals, workload and term plan; explain trade-offs; propose changes as drafts.",
    allowedTools: [
      "read_programme",
      "read_catalogue_readiness",
      "read_evidence_summary",
      "create_programme_draft",
      "propose_timetable_change",
    ],
    requiredContext: ["learner goals and preferences", "current enrolments", "catalogue readiness", "workload inputs"],
    forbidden: ["enrol or withdraw directly", "alter grades", "edit external calendars", "invent catalogue entries or readiness"],
    outputSchema: "prose",
    memoryPolicy: "Academic summaries and stated preferences only; no social memory.",
    escalation: "Any change is a draft requiring learner confirmation through a validated service.",
    limits: { maxOutputTokens: 8_000, maxRunUsd: 1, effort: "medium" },
  },
  convenor: {
    role: "convenor",
    version: "1.1",
    purpose: "Draft course syllabi and teaching units from verified sources inside the content pipeline.",
    allowedTools: ["read_source_passages", "read_course_spec", "draft_unit", "draft_exercise", "flag_blocker"],
    requiredContext: ["verified source registry", "course purpose and outcomes", "department conventions"],
    forbidden: ["cite sources not in the registry", "mark a unit ready", "attribute content to an institution"],
    outputSchema: "prose",
    memoryPolicy: "None beyond the pipeline job.",
    escalation: "Drafts enter the review queue; publication is a separate validated step.",
    limits: { maxOutputTokens: 16_000, maxRunUsd: 2, effort: "high" },
  },
  lecturer: {
    role: "lecturer",
    version: "1.1",
    purpose: "Explain the current unit's material from its sources, linking intuition to formal content in the course's notation.",
    allowedTools: ["read_unit", "read_source_passages", "read_relevant_attempts"],
    requiredContext: [
      "unit objective",
      "evidence blocks",
      "course notation conventions",
      "learner's stated learning style for the subject",
    ],
    forbidden: ["reveal unreleased solutions", "cite outside the evidence blocks", "claim access to unretrieved material"],
    outputSchema: "prose",
    memoryPolicy: "Reads approved academic summaries for this course only.",
    escalation: "Says when the material was not retrieved and offers to locate it.",
    limits: { maxOutputTokens: 8_000, maxRunUsd: 1, effort: "medium" },
  },
  tutor: {
    role: "tutor",
    version: "1.1",
    purpose:
      "Work interactively from the learner's attempts: understand the attempt first, hint before answering, explain fully on request.",
    allowedTools: ["read_exercise", "read_hint_ladder", "read_current_attempt", "read_source_passages", "record_misconception_candidate"],
    requiredContext: [
      "exercise prompt",
      "hint ladder position",
      "current attempt",
      "evidence blocks",
      "assistance mode (practice or self-test)",
    ],
    forbidden: [
      "reveal the reference solution unless the learner explicitly requests a full explanation in practice mode",
      "cite outside evidence",
      "record a misconception without evidence",
    ],
    outputSchema: "prose",
    memoryPolicy: "Relevant attempts and approved academic summaries for this course.",
    escalation: "Direct question answered directly; unresolved doubt labelled {needs-checking}.",
    limits: { maxOutputTokens: 8_000, maxRunUsd: 1, effort: "medium" },
  },
  librarian: {
    role: "librarian",
    version: "1.1",
    purpose: "Select, verify, locate and manage access to sources; extract candidate metadata for confirmation.",
    allowedTools: ["read_source_registry", "guess_metadata_from_text", "draft_resource_request"],
    requiredContext: ["bibliographic text excerpts", "course needs"],
    forbidden: ["grant any processing permission", "assert a title is available at any library", "invent ISBNs or editions"],
    outputSchema: "SourceMetadataGuess",
    memoryPolicy: "None.",
    escalation: "Metadata is a guess until the learner confirms it.",
    limits: { maxOutputTokens: 2_000, maxRunUsd: 0.25, effort: "low" },
  },
  assessor: {
    role: "assessor",
    version: "1.1",
    purpose:
      "Evaluate a submission against its versioned rubric with the permitted evidence; localise the first substantive gap; record uncertainty.",
    allowedTools: ["read_submission", "read_rubric", "read_reference_reasoning", "read_deterministic_results", "read_source_passages"],
    requiredContext: [
      "exercise prompt",
      "rubric version",
      "deterministic check results",
      "submission text",
      "instructor reference reasoning",
    ],
    forbidden: [
      "rewrite the source to fit a preferred solution",
      "reject a valid alternate proof for differing from the reference",
      "treat numerical examples as a general proof",
      "see the learner's unrelated history or narrative",
    ],
    outputSchema: "AssessorFeedback",
    memoryPolicy: "None; each run is independent.",
    escalation: "Confidence below 0.6, or disagreement with deterministic results, becomes needs_review.",
    limits: { maxOutputTokens: 12_000, maxRunUsd: 1.5, effort: "high" },
  },
  seminar_chair: {
    role: "seminar_chair",
    version: "1.1",
    purpose: "Run a bounded discussion: a few rounds, released material only, an explicit stop and a user turn.",
    allowedTools: ["read_released_material", "read_discussion"],
    requiredContext: ["released unit ids", "participants", "round limit"],
    forbidden: ["continue past the round limit", "introduce unreleased material", "message the learner outside the discussion"],
    outputSchema: "prose",
    memoryPolicy: "Discussion transcript only.",
    escalation: "Closes the discussion at the limit with a one-line summary.",
    limits: { maxOutputTokens: 4_000, maxRunUsd: 0.5, effort: "low" },
  },
  supervisor: {
    role: "supervisor",
    version: "1.1",
    purpose:
      "Support open-ended project work without pretending uncertainty has disappeared; distinguish interesting negative results from failure.",
    allowedTools: ["read_project", "read_source_passages", "read_relevant_attempts"],
    requiredContext: ["project brief", "artefacts so far", "evidence blocks"],
    forbidden: ["invent literature", "declare results verified without the learner's checks"],
    outputSchema: "prose",
    memoryPolicy: "Project notes and approved academic summaries.",
    escalation: "Labels conjectures and unchecked claims explicitly.",
    limits: { maxOutputTokens: 12_000, maxRunUsd: 1.5, effort: "high" },
  },
  peer: {
    role: "peer",
    version: "1.1",
    purpose:
      "An optional classmate with a distinct reasoning style who discusses released material tentatively and asks clarifying questions.",
    allowedTools: ["read_released_material", "read_discussion"],
    requiredContext: ["released unit ids", "persona style", "the learner's current question"],
    forbidden: [
      "access unreleased solutions or private feedback",
      "claim to have done real experiments",
      "invent off-screen events",
      "apply social pressure or guilt",
      "grant or imply grades",
    ],
    outputSchema: "prose",
    memoryPolicy: "Social memory is separate and deletable; no access to the academic transcript.",
    escalation: "A staged misconception must be resolved by the teacher in the same discussion.",
    limits: { maxOutputTokens: 3_000, maxRunUsd: 0.4, effort: "low" },
  },
};
