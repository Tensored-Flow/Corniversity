/**
 * Error notices shown after a redirect. A URL carries only a code from this allowlist; the text
 * a page shows is always the application's own, so a crafted link cannot put words on a page.
 * An unknown or missing code shows the neutral notice. Server actions turn a service's message
 * into its code with `errorCode`; a message that is not listed here becomes the neutral notice
 * (and is logged so it can be added). `notices.test.ts` checks that every literal message the
 * services throw is listed.
 */

/** Shown for a code that is not in the allowlist. */
export const NEUTRAL_NOTICE = "That could not be completed. Nothing was changed by this message; check the page and try again.";

export const ERROR_NOTICES = {
  "not-completed": NEUTRAL_NOTICE,
  // Messages that carry details: matched by their opening words, shown without the details.
  "proposal-overlap-undecided": "Decide on each overlapping course first; they are listed on this page.",
  "preparation-budget-out-of-range":
    "Choose a budget above $0 and no higher than the ceiling shown on this page (your monthly limit, and at most $20).",
  // bootstrap
  "sign-up-closed-institution-has": "Sign-up is closed. This institution has one owner account.",
  "setup-not-available-no-bootstrap": "Setup is not available: no bootstrap code is configured on the server.",
  "owner-email-bootstrap-code-not": "The owner email or bootstrap code is not correct.",
  // bridges
  "invalid-return-path": "Invalid return path.",
  "visit-not-found": "Visit not found.",
  "write-answer-least-sentence-before": "Write an answer of at least a sentence before seeing the guidance.",
  // community
  "give-discussion-title-question-passage": "Give the discussion a title: the question or passage you want to talk about.",
  "social-layer-off-quiet-mode":
    "The social layer is off (or you are in quiet mode), so AI classmates do not join. Office hours with faculty remain available.",
  "discussion-not-found": "Discussion not found.",
  // extension
  "proposal-not-found": "Proposal not found.",
  "draft-proposal-revised": "Only a draft proposal can be revised.",
  "reuse-concepts-exist": "Reuse only concepts that exist.",
  "reuse-prepared-units-from-current": "Reuse only prepared units from current courses.",
  "say-why-proposal-distinct-from": "Say why the proposal is distinct from this course.",
  "draft-proposal-rejected": "Only a draft proposal can be rejected.",
  "no-free-course-number-left": "No free course number is left in this department's range.",
  "draft-proposal-published": "Only a draft proposal can be published.",
  "no-source-has-been-verified": "No source has been verified for this course.",
  "no-syllabus-unit-has-been": "No syllabus or unit has been prepared.",
  "give-proposal-title-few-words": "Give the proposal a title of a few words.",
  "say-sentence-two-what": "Say in a sentence or two what it is for.",
  "describe-scope-what-covers-what": "Describe its scope: what it covers and what it leaves out.",
  // jobs-admin
  "job-not-found": "Job not found.",
  "unknown-queue": "Unknown queue.",
  "asset-no-longer-exists": "The asset no longer exists.",
  "asset-bytes-not-stored": "The asset's bytes are not stored.",
  // learning-issues
  "describe-issue-sentence-what-went": "Describe the issue in a sentence: what went wrong in which piece of work.",
  "unknown-concept": "Unknown concept.",
  "issue-not-found": "Issue not found.",
  "statement-needs-least-sentence": "The statement needs at least a sentence.",
  "say-briefly-why-disagree": "Say briefly why you disagree.",
  "say-what-resolved-link-work": "Say what resolved it, or link the work that did.",
  // learning
  "unit-not-found": "Unit not found.",
  "unit-not-prepared-yet": "This unit is not prepared yet.",
  "activity-not-found-unit": "Activity not found in this unit.",
  "course-version-not-found": "Course version not found.",
  "not-taking-course": "You are not taking this course.",
  "attempt-not-found": "Attempt not found.",
  "exercise-not-found": "Exercise not found.",
  "solutions-withheld-self-test-mode": "Solutions are withheld in self-test mode until you submit.",
  "no-reference-reasoning-available-exercise": "No reference reasoning is available for this exercise.",
  "assessment-not-found": "Assessment not found.",
  // library
  "file-empty": "The file is empty.",
  "pdf-markdown-plain-text-files":
    "Only PDF, Markdown and plain-text files are accepted as library assets. Scripts, notebooks and executables are refused.",
  "filename-not-acceptable": "The filename is not acceptable.",
  "asset-not-found": "Asset not found.",
  "pairing-code-not-valid-has": "That pairing code is not valid or has expired. Create a new one in the Library.",
  "file-has-not-been-stored": "The file has not been stored; grant private cloud storage first (or upload it).",
  "item-already-being-processed": "This item is already being processed.",
  "text-extraction-not-permitted-item": "Text extraction is not permitted for this item. Allow 'extraction and indexing' on the item page.",
  "job-file-already-exists-see": "A job for this file already exists; see the jobs page.",
  // notebook
  "title-required": "A title is required.",
  "unknown-entry-kind": "Unknown entry kind.",
  "saved-prediction-dated-record-cannot": "A saved prediction is a dated record and cannot be deleted.",
  // paper-work
  "page-not-found": "Page not found.",
  "page-file-missing": "The page's file is missing.",
  "write-transcription-first": "Write the transcription first.",
  "attach-least-one-page-before": "Attach at least one page before submitting paper work.",
  "tick-box-agree-sending-these": "Tick the box to agree to sending these page images for transcription.",
  "no-consent-was-recorded-these": "No consent was recorded for these pages.",
  "consent-send-these-pages-was": "Consent to send these pages was withdrawn, so nothing was sent.",
  "pages-changed-after-consent-was": "The pages changed after consent was given; ask again for the current pages.",
  // preparation
  "course-not-found": "Course not found.",
  "course-has-no-current-version": "This course has no current version.",
  "preparation-not-found": "Preparation not found.",
  "preparation-has-already-been-confirmed": "This preparation has already been confirmed.",
  "stopped-preparation-resumed": "Only a stopped preparation can be resumed.",
  "draft-not-found": "Draft not found.",
  "draft-passed-every-automatic-check": "Only a draft that passed every automatic check can be published.",
  "unit-no-longer-exists": "The unit no longer exists.",
  "draft-not-found-already-decided": "Draft not found or already decided.",
  // programmes
  "programme-not-found": "Programme not found.",
  // provider-config
  "choose-one-supported-models": "Choose one of the supported models.",
  "choose-live-model-before-approving": "Choose a live model before approving paid use.",
  "store-readable-api-key-before": "Store a readable API key before approving paid use.",
  "enter-amount-number-dollars-0": "Enter the amount as a number of dollars, 0 or more.",
  "say-where-amount-comes-from": "Say where the amount comes from (for example, the console's usage page).",
  "run-not-found": "Run not found.",
  "unsettled-run-settled": "Only an unsettled run can be settled.",
  "call-has-already-been-made": "This call has already been made or is in progress.",
  // recovery
  "two-passwords-do-not-match": "The two passwords do not match.",
  "no-owner-account-exists-yet": "No owner account exists yet. Create it through the website first.",
  "recorded-owner-account-no-longer": "The recorded owner account no longer exists.",
  "owner-has-no-password-credential": "The owner has no password credential to reset.",
  // research
  "project-not-found": "Project not found.",
  "give-project-title-3-200": "Give the project a title of 3 to 200 characters.",
  "state-question-10-1-000": "State the question in 10 to 1,000 characters.",
  "choose-one-kinds-project": "Choose one of the kinds of project.",
  "unknown-status": "Unknown status.",
  "keep-ten-leads-up-200": "Keep to ten leads of up to 200 characters each.",
  "unknown-document": "Unknown document.",
  "document-not-found": "Document not found.",
  "document-hold-most-100-000": "A document can hold at most 100,000 characters.",
  "there-nothing-draft-save-version": "There is nothing in the draft to save as a version.",
  "give-artefact-title": "Give the artefact a title.",
  "unknown-kind-artefact": "Unknown kind of artefact.",
  "notebook-entry-not-found": "Notebook entry not found.",
  "attach-image-png-jpeg-table": "Attach an image (PNG or JPEG), a table (CSV), code, JSON or text.",
  "artefacts-most-5-mb": "Artefacts can be at most 5 MB.",
  "attach-file-choose-notebook-entry": "Attach a file or choose a notebook entry.",
  "version-not-found": "Version not found.",
  "say-sentence-what-want-discuss": "Say in a sentence what you want to discuss.",
  "request-not-found": "Request not found.",
  // revision
  "profile-not-found": "Profile not found.",
  "choose-between-1-50-review": "Choose between 1 and 50 review items a week.",
  "unknown-weekday": "Unknown weekday.",
  // study-session
  "session-not-found": "Session not found.",
  "write-note-first": "Write the note first.",
  // study
  "not-allowed": "Not allowed.",
  "give-deadline-title": "Give the deadline a title.",
  "give-valid-due-date": "Give a valid due date.",
  "unknown-course": "Unknown course.",
  "unknown-exercise": "Unknown exercise.",
  // timetable
  "planned-sessions-moved": "Only planned sessions can be moved.",
  "term-not-found": "Term not found.",
  "time-outside-availability-clashes-protected": "That time is outside your availability or clashes with a protected commitment.",
  // core-transcription
  "write-transcription-before-confirming": "Write the transcription before confirming it.",
  // core-obligations
  "hard-deadlines-off-turn-them": "Hard deadlines are off. Turn them on in Settings if you want binding due dates.",
  "examinations-off-turn-them-settings": "Examinations are off. Turn them on in Settings if you want them.",
  // core-studio
  "give-title": "Give it a title.",
  "say-where-comes-from-url": "Say where it comes from: a URL or a citation, or for a simulation what ran it.",
  "record-version-date-was-retrieved": "Record the version or the date it was retrieved.",
  "record-licence-terms-use": "Record its licence or terms of use.",
  "record-random-seed-so-run": "Record the random seed, so the run can be repeated.",
  "record-what-generated-which-settings": "Record what generated it and with which settings.",
  "studio-does-not-take-new": "The studio does not take new data from people.",
  "data-about-people-needs-licence": "Data about people needs a licence or terms that permit this analysis; record them.",
  "data-about-people-come-from": "Data about people can only come from an existing dataset whose licence or terms permit the analysis.",
  // core-help
  "kind-help-exercise-ask-question": "This kind of help is for an exercise; ask a question about the material instead.",
  "write-some-approach-first-so": "Write some of your approach first, so there is something to discuss.",
  "write-step-first-then-select": "Write the step first, then select its lines.",
  "select-lines-attempt-want-checked": "Select the lines of your attempt you want checked.",
  "self-test-mode-withholds-full":
    "Self-test mode withholds full explanations until you submit. Ask for a small hint, or work on this exercise in practice mode.",
  // web-[id]
  "goes-beyond-course-load-chose": "This goes beyond the course load you chose.",
  // web-library
  "unknown-permission": "Unknown permission.",
  "say-briefly-what-basis-deciding":
    "Say briefly on what basis you are deciding (for example the licence, or 'my own notes'). It is recorded with the decision.",
  "tick-confirmation-box-delete-item": "Tick the confirmation box to delete this item.",
  "title-reason-required": "A title and a reason are required.",
  "suggestion-no-longer-available": "That suggestion is no longer available.",
  "production-data-root-server-use": "In production the data root is the server's; use the download buttons instead.",
  "write-note-before-saving": "Write a note before saving.",
  "processing-could-not-started": "Processing could not be started.",
  "job-could-not-cancelled": "The job could not be cancelled.",
  "job-could-not-retried": "The job could not be retried.",
  // web-notebook
  "write-entry-itself-title-own": "Write the entry itself; a title on its own is not kept.",
  "tick-confirmation-box-delete-entry": "Tick the confirmation box to delete this entry.",
  // web-proposals
  "check-fields": "Check the fields.",
  // web-[id]
  "invalid-request": "Invalid request.",
  // web-settings
  "key-looks-too-short-api": "The key looks too short to be an API key.",
  "unknown-run": "Unknown run.",
  "tick-box-allow-dictation": "Tick the box to allow dictation.",
  // web-studio
  "no-faculty-member-available-office": "No faculty member is available for office hours.",
  // web-timetable
  "route-was-proposed-earlier-focus":
    "That route was proposed for an earlier focus, so nothing changed: your focus stays as you set it since. Ask the director again for a route from where you are now.",
  "unknown-deadline-kind": "Unknown deadline kind.",
  // study preferences (packages/core/src/planning/preferences.ts)
  "study-unknown-rhythm": "Unknown study rhythm.",
  "study-invalid-preview-time": "Invalid preview time.",
  "study-heavier-load-needs-preview": "A heavier course load needs the workload preview first; open it, read it, then confirm.",
  "study-main-courses-range": "Main courses must be between 1 and the maximum shown in Settings.",
  "study-exploratory-courses-range": "Exploratory courses must be between 0 and the maximum shown in Settings.",
  // exams
  "exam-take-course-first": "Take the course before sitting its exam.",
  "exam-already-running": "An exam on this course is already running. Finish it first.",
  "exam-no-problems-left": "You have attempted every prepared problem in this course, so none is left for an exam.",
  "exam-not-found": "Exam not found.",
  "exam-time-up": "Time is up. What you saved before the deadline is what counts.",
  "exam-question-not-in-exam": "That question is not part of this exam.",
  "exam-already-submitted": "This exam has been submitted; answers can no longer change.",
  "exam-questions-range": "Choose between 1 and 10 questions.",
  "exam-minutes-range": "Choose between 5 and 300 minutes.",
  // chatgpt-plan
  "plan-sign-in-not-started": "This sign-in was not started here, or it has already been used. Start again from Settings.",
  "plan-sign-in-expired": "The sign-in took longer than ten minutes. Start again from Settings.",
  "plan-sign-in-declined": "You declined the sign-in, so nothing was connected and nothing will be sent to ChatGPT.",
  "plan-sign-in-provider-error": "OpenAI's sign-in ended with an error, so nothing was connected.",
  "plan-sign-in-no-code": "OpenAI's sign-in did not return an authorization code, so nothing was connected.",
  "plan-registration-incomplete": "OpenAI did not return Corniversity's registration for this computer, so nothing was connected.",
  "plan-registration-mismatch": "OpenAI returned a different registration than the one this sign-in used, so nothing was replaced.",
  "plan-tokens-missing": "OpenAI's answer lacked the ID or refresh token the plan connection needs.",
  "plan-id-token-invalid": "OpenAI's identity token did not verify, so nothing was connected.",
  "plan-account-mismatch":
    "That is a different ChatGPT account from the one registered here. Use “a different ChatGPT account” in Settings.",
  "plan-no-permission":
    "The sign-in did not grant permission to use your ChatGPT plan, so nothing will be sent. Continue with ChatGPT again and allow plan usage, or choose another way to teach.",
  "plan-renewal-failed": "The ChatGPT sign-in could not be renewed just now. Try again later.",
  "plan-model-unknown": "Choose one of the models your ChatGPT account offers.",
  "plan-choose-provider-first": "Choose your ChatGPT plan as the way to teach before approving its use.",
  "plan-connect-first": "Continue with ChatGPT before approving plan use.",
  "plan-choose-model-first": "Choose a model from your ChatGPT account before approving plan use.",
  "plan-hosted-unavailable": "This is the hosted site; OpenAI allows plan usage in locally hosted apps unless it approves a hosted one.",
  "plan-not-loopback": "This installation isn't served on this computer's own address, so it isn't locally hosted.",
  "plan-limit-whole-number": "Every request limit must be a whole number of at least 1.",
  "plan-limit-daily-above-monthly": "The daily request limit cannot exceed the monthly one.",
  "plan-limit-daily-ceiling": "The daily limit can be at most 200 requests.",
  "plan-limit-monthly-ceiling": "The monthly limit can be at most 3000 requests.",
  "plan-sign-in-failed": "The sign-in with ChatGPT could not be completed, so nothing was connected. Start again from Settings.",
} as const;

export type ErrorCode = keyof typeof ERROR_NOTICES;

/** Opening words of messages that carry details (names, amounts), and the code each maps to. */
const PREFIX_CODES: readonly (readonly [string, ErrorCode])[] = [
  ["Decide on each overlapping course first", "proposal-overlap-undecided"],
  ["Choose a budget above $0", "preparation-budget-out-of-range"],
  ["The sign-in could not be completed", "plan-sign-in-failed"],
  ["Main courses must be between", "study-main-courses-range"],
  ["Exploratory courses must be between", "study-exploratory-courses-range"],
];

const CODE_BY_TEXT: ReadonlyMap<string, ErrorCode> = new Map(
  (Object.entries(ERROR_NOTICES) as [ErrorCode, string][]).filter(([code]) => code !== "not-completed").map(([code, text]) => [text, code]),
);

export function isErrorCode(code: string): code is ErrorCode {
  return Object.hasOwn(ERROR_NOTICES, code);
}

/**
 * The code for an application message: an exact match, else a listed message the text begins
 * with (validation messages joined in one sentence), else a message with details, else the
 * neutral code.
 */
export function errorCode(message: string): ErrorCode {
  const exact = CODE_BY_TEXT.get(message);
  if (exact) return exact;
  for (const [text, code] of CODE_BY_TEXT) if (message.startsWith(`${text} `)) return code;
  for (const [prefix, code] of PREFIX_CODES) if (message.startsWith(prefix)) return code;
  console.warn("[notices] unlisted error message shown as the neutral notice:", message.slice(0, 200));
  return "not-completed";
}

/** The text for a code from a URL: listed text, the neutral notice for anything else, nothing when absent. */
export function errorNotice(code: string | string[] | undefined): string | null {
  if (code === undefined || code === "") return null;
  if (typeof code !== "string") return NEUTRAL_NOTICE;
  return isErrorCode(code) ? ERROR_NOTICES[code] : NEUTRAL_NOTICE;
}

/** A redirect target carrying an error code: `path` may already have a query; `hash` keeps its `#`. */
export function errorHref(path: string, code: ErrorCode, hash = ""): string {
  return `${path}${path.includes("?") ? "&" : "?"}error=${code}${hash}`;
}
