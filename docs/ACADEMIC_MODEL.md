# Academic model

## Institutions and roles

Six departments (Mathematics; Physics; Chemistry; Computer Science & AI; Neuroscience;
Cognitive Science & Psychology). A department is configuration: identity text, faculty roster,
catalogue, prerequisite structure, teaching conventions. Courses have one authoritative content
version and may be cross-listed.

Roles adapted from ALTER (advisor → director of studies; librarian; tutor; editor → assessor;
roommate → optional peers; flashcards → bounded retrieval practice) plus convenor, lecturer,
seminar chair and research supervisor. All AI, all labelled.

## Readiness

Course: `proposed` → `source_verified` → `syllabus_ready` → `teaching_ready`; `resource_blocked`
is a side state with a visible alternative or request. Unit: `draft` → `checking` → `ready`
(`blocked` side state). A course is `teaching_ready` only when its first two units are `ready`
and every unit in the syllabus has a verified locator; the validator enforces this structure.
The substantive checks a unit records (`mathematical-review`, `source-review`) are the content
author's own review and are shown as such; they are not independent verification, and the
assessment of the learner's work never depends on them.

## Prerequisites

Concept-level graph. Rules are `hard` (rare, justified) or `soft`. A rule has alternative groups;
satisfying any group satisfies the rule. Evidence that satisfies a concept: `demonstrated` or
`practised` state, a passed placement check, or a learner override (recorded with provenance and
shown as "unverified"). Audit mode ignores prerequisites. Cycle detection runs in the validator.

Three things stay apart (`packages/core/src/prerequisites/bridges.ts`): the definition (concepts
belong to departments and exist whether or not a course teaching them is prepared; NEU-101 lists
the biology concepts it will teach while it is still proposed), the learner's evidence (supported
by submitted work, self-reported and unverified, or not shown; reading, viewing a bridge or seeing
a solution never counts as support) and whether a short concept bridge is prepared. A rule is met
only by its own concepts, so mathematical evidence never meets a biology rule: NEU-220's soft rule
on the membrane potential stands beside its mathematics rule. Bridges nest at most two deep from a
lesson, and a concept already on the trail is reported as a cycle, never followed.

## Teaching units

Objective, prerequisite concepts, preparation (source locators), activities (reading, lecture,
worked example, problems, lab, discussion), exercises with hint ladders and rubrics, instructor
artifacts (server-side only), exit check, common misconceptions. Sessions: lecture/reading,
tutorial, problem class, seminar, lab, revision, oral explanation, project.

## Tutor policy (encoded in role contracts)

Understand the attempt first; hint ladder before answers; direct explanation on request; label
statements (source-backed / derived / conjecture / needs checking); define notation; offer another
representation when stuck; record misconceptions only with evidence; summarise and suggest one
next step. The campus layer never interrupts proof work.

## Help and paper work

Four kinds of help on an exercise, decided before any model call (`packages/core/src/tutoring/help.ts`):
a small hint (one direction, no solution), discussing the approach (structure and assumptions,
without replacing it), checking a step (only the selected lines) and a full explanation (refused in
self-test mode until the attempt is submitted). Every request, authored hint and reveal is recorded
as assistance; a full explanation before a submission makes that submission assisted, so an
acceptance counts as practice, never as a demonstration. The tutor is never given a reference
solution.

Paper work is first-class: photographs (re-encoded on the device and stripped again on the server)
or PDFs (refused with active content) are kept apart from their transcription. Uncertain symbols are
marked `[[?…]]` and must be confirmed before review; an uncertain reading is never a judgement of
the mathematics. The review reads the confirmed transcription; a correction is a new version, and
feedback on an earlier version says so. A model may draft the transcription only with consent for
those pages and an approved live model; the scripted demo never reads images.

## Assessment

Submission versions are immutable, and each assessment keeps the exercise as the learner
answered it (prompt, rubric version and checks), so a later repair of the exercise never changes
what a submission was assessed against; a regrade assesses against the same version. States: draft → submitted → reviewing → feedback_ready |
revision_requested | needs_review → revised → accepted. Feedback: statement fidelity, hypotheses,
quantifiers, logical steps, cited results, boundary cases, first substantive gap (line-localised),
alternate proofs accepted. Deterministic checks run first where they apply (e.g. the norms of
`x^n` on `[0,1]`: sup norm 1, L¹ norm 1/(n+1)); a model assessor adds structured feedback with
confidence; low confidence ⇒ `needs_review`. Appeals and regrades are first-class records.
Feedback that repeats the hidden reference solution (a run of ten consecutive words the learner has
not seen in the prompt or in their own submission) is withheld before it is stored.

Feedback on modelling work keeps seven things apart: implementation, statistical or
computational method, evaluation design, interpretation, scientific claims, reproducibility and
uncertainty. Running code, a good metric, a named parameter or an AI's agreement is never taken
as understanding, validity, a measured construct or certification. A defensible alternative
approach is accepted, and so is a meaningful negative result. Feedback from a model is
provisional; without a live model the assessor withholds its verdict and says that no model read
the work.

## Evidence

Concept states: `unassessed`, `introduced`, `practised`, `demonstrated`, `revisit`, each linked
to evidence events with dates. Self-reported confidence is separate. Time spent, activities
completed, assistance received and understanding demonstrated are separate facts. No mastery
percentages.

## Learning issues and review

A learning issue is a specific point in a piece of work: a claim, a missing hypothesis, a value
outside its tolerance. It is proposed by an automatic check that looks for an error (a forbidden
claim, a missing hypothesis, finitely many examples offered as proof, a wrong value), by a live
assessor's first gap, or written by the learner, and it links to the submission and the check that
raised it. The learner confirms it (correcting its wording), disputes it, marks it for revisiting,
resolves it, or deletes it. When the same check passes on a later submission the issue is resolved
with that submission named. Omissions (a step not shown) do not become issues; they stay feedback.
Issues are never sent to the assessor and never phrased as traits of the learner.

Review follows one stated rule: an item comes back after two days; recalled doubles the gap (up to
sixty days), shaky keeps it, forgot brings it back tomorrow. The learner sets a weekly number (a
default comes from their weekly hours), may pause review, keep weekdays free, snooze or archive
an item. At most five items are offered at a time. Items past their date are reported as
information, never as a debt, and ordinary study never waits for review.

## Problem progressions

An exercise may carry a progression: its stage (worked example, independent, unfamiliar,
counterexample, synthesis), a difficulty with the basis for it, its provenance, the help modes it
permits, and for an unfamiliar problem a transfer note naming the familiar exercise it departs
from. The validator enforces these; the next task is proposed in stage order. Four routes carry
full progressions (MAT-230 units 1 to 4, MAT-262 units 1 and 2, COG-260 and COG-250 unit 1,
CHE-101 unit 5). A stage describes the exercise's place in a route; it is not a grade.

## Voice and visual explanations

Dictation and reading aloud are optional ways in and out of the same text. Dictated words land
in the learner's own box to be corrected before anything is sent, and a dictated attempt is
assessed like any other but marked as a spoken explanation. A visual explanation is a storyboard
whose plots are computed from stated parameters and whose claims are checked numerically; it is
offered only when checked, says whether a second reader has reviewed it, and, when it shows an
exercise's answer, stays closed until the learner has attempted that exercise or chosen to see
its reasoning. Watching is never evidence of understanding.

## Course preparation

A learner may ask for a course to be prepared further. The request records their goal, depth,
weekly hours, balance, assessment preference, materials and the number of units to prepare, with
a budget of at most $20 (and never more than the monthly limit). It is a proposal until confirmed
and never enrols anyone. The stages are: inspect the sources, assemble the primary shelf, map
concepts and prerequisites, set syllabus and workload, list resources to obtain (all deterministic,
by the librarian or the registrar), draft each unit (the AI convenor, a live model only), check
each draft (structure, verified sources, notation, rubric weights, leaked answers), and
publication, which is the owner's. Without a live model drafting is blocked with its reason;
nothing is invented in its place. A published draft fills an outlined unit only, never a prepared
one, and later seeding leaves it in place.

## Programmes

A programme is a route through several courses, organised in blocks. A block states its central
question, entry level, coverage, bridges, a source shelf (verified sources, or leads labelled as
unverified), the course units that serve it, activities, the evidence of understanding and its
gaps. Its readiness is derived from the mapped units (prepared, partly prepared, sources only,
proposed) and never authored. A unit that serves several blocks is studied once and assessed
once. Following a programme enrols in nothing; the director may draft a route (focus blocks and
suggested courses) that the learner confirms or rejects. A route proposes at most two focus
blocks and two new courses within the chosen load, keeps the learner's existing focus and
courses, and shows exactly what confirming changes: the focus before and after, and each
course's action (continue, enrol from its page after the workload preview, audit or read, or
later). It explains each prerequisite rule as met (by assessed work or by the learner's own
report, labelled unverified) or still to prepare, with its alternatives; a rule is met only by its
own concepts, so a mathematics background never stands in for biology, psychology, programming or
method preparation. Confirming sets the focus and enrols in nothing. Each block has its own page
with one next step, the curriculum's readiness kept apart from the learner's progress, and what
is missing; a missing optional source never blocks other work. A programme also lists its modelling
methods, with introduced, practised and demonstrated shown separately, its electives and a
bounded paper seminar. The Mind, Brain and AI programme is described in
[MIND_BRAIN_AI.md](MIND_BRAIN_AI.md).

## Workload and timetable

Defaults for a new learner: rolling, self-paced study with no completion date; one main course
and at most one lighter exploratory course or reading seminar; weekly study appointments on;
hard deadlines and examinations off. Each is a choice in Settings, and an explicit choice always
wins over a default. Term mode (ten teaching weeks, a reading week and a synthesis week,
editable) is optional and switches on neither examinations nor deadlines. A heavier load needs
the workload preview first, and every enrolment is an explicit act. Three things stay separate:
the content sequence (which unit comes next), study appointments (sessions on the timetable) and
academic deadlines (binding only when the learner has switched them on). A missed appointment is
never a penalty. Units are content, not calendar weeks; workload estimates are ranges including
reading, problems, practice and projects.

## Predictive claims

Every predictive exercise and laboratory result states its information contract before any
number: observed; prediction target; history in training; history at inference; person; task;
later time periods; unavailable in real use; simplest baseline; claims not tested. A laboratory
that makes predictions keeps its results hidden until the learner has saved a prediction in the
notebook; the prediction is a note, never evidence of understanding. *Predict again* hides the
results until a new prediction is saved; earlier predictions stay in the notebook as dated records
that cannot be edited or deleted, and no older note can be tagged as a prediction.

Held-out trials of stimuli the fit has seen and stimuli absent from training answer different
questions. Either can be useful; they are not interchangeable. A laboratory that offers both
states each split's question and contract (NEU-220's tuning laboratory: every fourth repetition
of each orientation, or every trial of one orientation), and a result from one split is never
reported as the other.

## Research studio

A project starts from a question and is one of five kinds: conceptual analysis, mathematical
investigation, computational modelling, replication or re-analysis, and critical review. It has a
focused shelf of verified source records (anything else is a lead for the library's list),
proposal, methods and report documents saved as numbered versions that later drafts never
change, provenance for every dataset and simulation (a simulation records its seed and
generator; data about people can only come from an existing dataset whose licence or terms permit
the analysis), notebook entries tagged
with the project, and small private artefacts. Feedback attaches to a saved version: structural
checks that say which parts are present, never whether the reasoning is right, plus written
feedback only from an approved live model, labelled provisional. The report keeps apart the
question, observations, assumptions, model predictions, competing explanations, the available
information, what the evidence establishes, what remains unsupported, reproducibility and
uncertainty, and is assembled with the project's own records. An optional oral discussion is held
as bounded office hours. The studio never recruits anyone, collects new data from people,
contacts anyone, publishes or imports private data. A proposal or method that plans to collect
from people is flagged and the sentence quoted; re-analysing an existing dataset about people, or
describing how its authors collected it, is not. A demonstration project is labelled as not the
learner's work.

## Honesty rules

No invented sources, chapters or exercise numbers; external course dates separate from personal
term dates; "adapted study path using these materials", never "enrolled at MIT"; personal
certificates are informal records; bots, peers and faculty are labelled AI everywhere, with the
model named when a live model produced the text and "scripted demo" when none did. A live model
runs only with a readable key and the owner's approval of paid use within finite limits; when it
cannot run the reason is shown and nothing scripted replaces it.
