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
  "entry-longer-than-limit": "The entry is longer than 50,000 characters; shorten it, or split it into two entries.",
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
  // research library
  // library.ts (Documents, annotations, reading positions)
  "annotation-conflict": "This note was changed elsewhere after you opened it. Both versions are shown; nothing was overwritten.",
  "document-already-stored": "This paper's file is already stored here.",
  "file-stored-for-other-version": "This file is already stored for another version or paper in your library.",
  "file-in-library-as-other-item":
    "This file is already in your library as another item. Delete that item first, then attach the file here; its notes come with it.",
  "linked-key-taken": "Another file in your library already stands for this arXiv version, so this copy was not removed.",
  "copy-changed": "This file changed since the page was opened, so nothing was removed. The page now shows it as it is.",
  "item-changed-while-arriving": "The item changed while the file was arriving; nothing was stored.",
  "paper-file-details-on-paper-page": "This file belongs to a paper in your library; its details are edited on the paper's page.",
  "linked-keep-copy-on-paper-page": "This paper is read from arxiv.org; keep a private copy from its paper page instead.",
  "linked-nothing-to-delete": "A paper read from arxiv.org has no stored file to delete.",
  "linked-nothing-to-extract": "This paper is read from arxiv.org; nothing is stored here to extract.",
  "reading-position-invalid": "The reading position is not valid.",
  "annotation-kind-unknown": "Unknown annotation kind.",
  "annotation-place-invalid": "The annotation's place on the page is not valid.",
  "highlight-needs-area": "A highlight needs the marked area of the page.",
  "highlight-colour-unknown": "Unknown highlight colour.",
  "annotation-not-found": "Annotation not found.",
  "annotation-edit-no-version": "The edit does not say which version it changes.",
  // scholarly-works.ts (provider failures are the service's own sentences, never the provider's)
  "arxiv-no-record": "arXiv has no record of this identifier.",
  "crossref-no-record": "Crossref has no record of this DOI.",
  "openalex-no-record": "OpenAlex has no record of this identifier.",
  "identifier-not-valid": "That identifier is not valid.",
  "provider-rate-limited": "The provider is limiting requests just now. Nothing was changed; try again later.",
  "openalex-budget-used": "OpenAlex's daily allowance for this server is used up. Nothing was changed; lookups work again after it resets.",
  "provider-unreachable": "The provider could not be reached just now. Nothing was changed; try again later.",
  "provider-fixture-missing": "No recorded provider response exists for this request (fixture mode), so it is unavailable.",
  "provider-not-fetched-yet": "Not fetched from the provider yet.",
  "provider-answer-unusable": "The provider's answer could not be used. Nothing was changed.",
  "paper-not-found": "Paper not found.",
  "arxiv-record-other-paper": "The arXiv record belongs to a different paper.",
  "paper-needs-title": "Give the paper a title.",
  "paper-edit-conflict":
    "These details changed after you opened the form, so nothing was saved. The page now shows them; make your correction again.",
  "paper-year-range": "The year must be a whole number between 1000 and 2100.",
  "arxiv-record-not-fetched": "The arXiv record of this paper has not been fetched yet, so this version cannot be opened.",
  "arxiv-version-withdrawn": "This arXiv version was withdrawn, so it is not opened here.",
  "paper-file-not-linked": "This paper's file could not be linked; try again.",
  "observed-hash-linked-only": "Only a paper read from arxiv.org reports what the browser received.",
  "observed-hash-invalid": "The reported file hash is not valid.",
  // The reading companion (core COMPANION_REFUSALS, services/companion.ts, /api/library/ask): refused before any model call
  "companion-deleted": "This document has been deleted, so the companion cannot read it.",
  "companion-local-only":
    "This document is on your desktop only: its contents have never left your device, so the companion cannot read it.",
  "companion-not-extracted": "Corniversity has not extracted this document's text yet, so the companion has nothing to read.",
  "companion-file-unreported":
    "The reader has not yet reported which file it received from arXiv; wait until the pages have loaded, then ask again.",
  "companion-file-changed": "arXiv's file has changed since your notes were made; resolve that in the reader before asking.",
  "companion-ai-denied": "You have not allowed external AI for this document.",
  "companion-ai-unknown": "External AI has not been allowed for this document. Only you can allow it, with its licence shown.",
  "companion-selection-too-long": "The selection is longer than 4000 characters; select a shorter passage.",
  "companion-text-too-long": "Keep what you write to 2000 characters.",
  "companion-linked-needs-selection": "For a paper read from arXiv the companion sees only the text you select; select the passage first.",
  "companion-open-page": "Open the page you are asking about first.",
  "companion-write-question": "Write your question first.",
  "companion-select-passage": "Select the passage you want explained.",
  "companion-select-notation": "Select the symbol or expression you want explained.",
  "companion-notation-too-long": "Select only the notation you want explained (up to 300 characters).",
  "companion-select-argument": "Select the argument you want questioned.",
  "companion-write-explanation": "Write your own explanation first (a sentence or two), so there is something to check.",
  "companion-request-invalid": "That request to the companion is not valid, so nothing was sent.",
  "companion-page-missing": "Corniversity has no extracted text for that page of this document, so nothing was sent.",
  // A model run refused by the provider state or a limit (the reason with its amounts travels beside it)
  "companion-budget-refused": "No model was asked and nothing was charged: a limit you set stops this request.",
  "companion-provider-blocked": "No model was asked and nothing was charged: the model provider is blocked.",
  "page-geometry-invalid": "The reported page geometry is not valid.",
  "file-not-paper-version": "This file is not a version of a paper.",
  "file-attached-other-paper": "This file is already attached to another paper in your library.",
  "file-changed-while-attaching": "The file changed while it was being attached; nothing was changed.",
  "version-has-stored-file":
    "This version already has a stored file in your library. Remove that copy first if this file should replace it.",
  "private-copy-in-library":
    "arXiv's file for this version is already in your library as another item. Delete that item first, then keep the private copy; its notes come with it.",
  "paper-changed-while-updating": "The paper changed while it was being updated; try again.",
  "delete-merged-paper": "This paper was merged into another paper; delete it from that paper's page.",
  "merge-into-itself": "A paper cannot be merged into itself.",
  "merge-already-merged": "One of these papers was already merged into another.",
  "paper-no-lookup-identifier": "This paper has no identifier a provider can look up.",
  "subjects-from-list": "Choose subjects from the list.",
  // private copies refused: the reasons of storageDecision (packages/core/src/scholarly/licence.ts)
  "copy-version-withdrawn": "This version was withdrawn on arXiv, so Corniversity keeps no copy of it.",
  "copy-exact-arxiv-version-only": "Private copies are kept only for an exact arXiv version whose licence arXiv reports.",
  "copy-licence-display-only":
    "This licence is reported by a provider other than arXiv; it is shown for information and does not permit a private copy.",
  "copy-no-arxiv-licence": "arXiv has not reported a licence for this version, so it stays reference-only.",
  "copy-licence-no-date": "The licence has no retrieval date, so it cannot be the basis of a private copy.",
  "copy-arxiv-nonexclusive": "arXiv's licence for this version does not permit Corniversity to store a copy; it is read from arxiv.org.",
  "copy-licence-nc-nd":
    "This licence carries non-commercial or no-derivatives terms; Corniversity keeps private copies only under CC BY, CC BY-SA, CC0 or public domain.",
  "copy-licence-not-open": "This licence is not one Corniversity recognises as open, so the version stays reference-only.",
  // paper-lists.ts (Find papers, the preview, the paper page's lists)
  "openalex-browsing-needs-key": "OpenAlex browsing needs an API key on this server.",
  "find-type-words": "Type words to search for.",
  "find-page-limit": "OpenAlex pages stop at 10,000 results.",
  "find-years-invalid": "Give the years as whole numbers between 1000 and 2100, the first no later than the second.",
  "find-type-unknown": "Choose a type from the list.",
  "find-field-unknown": "Choose a field from the list.",
  "find-author-invalid": "Give the author's name in letters, at most 100 characters.",
  "doi-unknown-everywhere": "Neither OpenAlex nor Crossref has a record of this DOI.",
  // web-papers (paper page, attaching a file, adding a paper without an identifier)
  "attach-choose-file": "Choose a PDF file to attach.",
  "upload-interrupted": "The file did not arrive in full (the connection may have dropped), so nothing was stored. Attach it again.",
  "attach-too-large": "The file is larger than this server's upload limit.",
  "paper-file-pdf-only": "A paper's file must be a PDF; nothing was stored.",
  "upload-not-pdf-signature": "The file does not start with a PDF signature; it was not stored.",
  // Service sentences with a semicolon, which the notices test's scan used to skip.
  "community-two-classmates-most": "A discussion takes at most two classmates, so that it stays a conversation you lead; choose two.",
  "proposal-existing-department": "Choose one of the existing departments; a proposal does not create a department.",
  "proposal-changed-while-publishing": "The proposal changed while it was being published; open it again.",
  "attempt-already-accepted": "This attempt has already been accepted; start a new one.",
  "attempt-has-work-finish-first": "This attempt already has work in it; finish or submit it before starting another.",
  "prediction-cannot-be-changed": "A saved prediction is a dated record and cannot be changed; write a new note, or predict again.",
  "prediction-laboratory-only": "Only a laboratory saves predictions; an existing note cannot be tagged as one.",
  "paper-work-attempt-accepted": "This attempt has been accepted; start a new attempt to add pages.",
  "paper-work-confirm-transcription": "Confirm the transcription before submitting; the review reads it, not the photograph.",
  "paper-work-transcription-reads-photographs":
    "Model transcription reads photographs; attach images of the pages, or transcribe a PDF yourself.",
  "unit-already-prepared": "This unit is already prepared; a draft only fills an outlined unit.",
  "settlement-above-worst-case":
    "That is more than this run's worst case, which should not be possible. Nothing was changed; please report it, since the bound would need correcting.",
  "shelf-verified-sources-only": "Only verified source records can go on the shelf; add other titles as leads.",
  "tick-box-remove-file": "Tick the box to remove this file.",
  "tick-box-merge-papers": "Tick the box to merge these papers.",
  "tick-box-delete-paper": "Tick the box to delete this paper and its notes.",
  // notebook/actions.ts: deleting a reading note from the library notes view
  "tick-box-delete-note": "Tick the box to delete this note.",
  // library-collections.ts (shelves and trails)
  "collection-give-name": "Give it a name.",
  "collection-name-length": "Keep the name under 120 characters.",
  "collection-not-found": "Shelf or trail not found.",
  "collection-kind-choose": "Choose a shelf or a trail.",
  "shelf-name-taken": "You already have a shelf with that name.",
  "trail-name-taken": "You already have a trail with that name.",
  "collection-move-direction": "Move a paper up or down.",
  // library/actions.ts: the fallback when an extraction request fails for another reason
  "library-request-failed": "The request failed.",
  "tick-box-delete-shelf": "Tick the box to delete this shelf.",
  "tick-box-delete-trail": "Tick the box to delete this trail.",
  // discover.ts (Discover and subject rooms): a list that cannot be shown says what happened, never "no results"
  "subject-not-found": "Subject not found.",
  "surprise-choose-from-page": "Choose a surprise from this page.",
  "discover-openalex-key-needed": "OpenAlex browsing needs an API key on this server.",
  "discover-list-budget": "OpenAlex's daily allowance for this server is used up, so this list was not fetched.",
  "discover-list-rate-limited": "The provider was limiting requests when this list was fetched; it is tried again later.",
  "discover-list-unavailable": "The provider could not be reached when this list was fetched; it is tried again later.",
  "discover-list-fixture-missing": "Not recorded in fixture mode, so this list is unavailable.",
  "discover-list-unusable": "The provider's answer for this list could not be used.",
  "discover-list-refresh-failed": "Fetching this list failed; the job's record is on the Jobs page.",
  // An out-of-date list stays on the page; its refresh failed
  "discover-refresh-budget": "OpenAlex's daily allowance for this server is used up, so this list was not refreshed.",
  "discover-refresh-rate-limited": "The provider was limiting requests when this list was refreshed; it is tried again later.",
  "discover-refresh-unavailable": "The provider could not be reached when this list was refreshed; it is tried again later.",
  "discover-refresh-fixture-missing": "Not recorded in fixture mode, so this list was not refreshed.",
  "discover-refresh-unusable": "The provider's answer could not be used, so this list was not refreshed.",
  "discover-refresh-failed": "Refreshing this list failed; the job's record is on the Jobs page.",
} as const;

export type ErrorCode = keyof typeof ERROR_NOTICES;

/** Opening words of messages that carry details (names, amounts), and the code each maps to. */
const PREFIX_CODES: readonly (readonly [string, ErrorCode])[] = [
  ["Decide on each overlapping course first", "proposal-overlap-undecided"],
  ["Choose a budget above $0", "preparation-budget-out-of-range"],
  ["The sign-in could not be completed", "plan-sign-in-failed"],
  ["Main courses must be between", "study-main-courses-range"],
  ["Exploratory courses must be between", "study-exploratory-courses-range"],
  ["This licence is as reported by ", "copy-licence-display-only"],
];

/** Middle words of messages that open with a detail (a licence name), and the code each maps to. */
const CONTAINED_CODES: readonly (readonly [string, ErrorCode])[] = [
  [" carries non-commercial or no-derivatives terms; ", "copy-licence-nc-nd"],
  // validateUpload (library.ts): "The file is 250.0 MB; the limit is 200 MB."
  [" MB; the limit is ", "attach-too-large"],
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
  for (const [middle, code] of CONTAINED_CODES) if (message.includes(middle)) return code;
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

const withParam = (path: string, param: string) => `${path}${path.includes("?") ? "&" : "?"}${param}`;

/**
 * `back` with `param` (a notice: `saved=…` or `error=…`) in its query. A #fragment stays last and is
 * also named as `at`, so the page shows the notice inside the section the browser scrolls to, where
 * it is in view, instead of above it.
 */
export function placed(back: string, param: string): string {
  const i = back.indexOf("#");
  if (i < 0) return withParam(back, param);
  const hash = back.slice(i);
  return `${withParam(withParam(back.slice(0, i), `at=${hash.slice(1)}`), param)}${hash}`;
}
