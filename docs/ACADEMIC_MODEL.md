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

## Assessment

Submission versions are immutable. States: draft → submitted → reviewing → feedback_ready |
revision_requested | needs_review → revised → accepted. Feedback: statement fidelity, hypotheses,
quantifiers, logical steps, cited results, boundary cases, first substantive gap (line-localised),
alternate proofs accepted. Deterministic checks run first where they apply (e.g. the norms of
`x^n` on `[0,1]`: sup norm 1, L¹ norm 1/(n+1)); a model assessor adds structured feedback with
confidence; low confidence ⇒ `needs_review`. Appeals and regrades are first-class records.

## Evidence

Concept states: `unassessed`, `introduced`, `practised`, `demonstrated`, `revisit`, each linked
to evidence events with dates. Self-reported confidence is separate. Time spent, activities
completed, assistance received and understanding demonstrated are separate facts. No mastery
percentages.

## Programmes

A programme is a route through several courses, organised in blocks. A block states its central
question, entry level, coverage, bridges, a source shelf (verified sources, or leads labelled as
unverified), the course units that serve it, activities, the evidence of understanding and its
gaps. Its readiness is derived from the mapped units (prepared, partly prepared, sources only,
proposed) and never authored. A unit that serves several blocks is studied once and assessed
once. Following a programme enrols in nothing; the director may draft a route (focus blocks and
suggested courses) that the learner confirms or rejects. A programme also lists its modelling
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
notebook; the prediction is a note, never evidence of understanding.

## Honesty rules

No invented sources, chapters or exercise numbers; external course dates separate from personal
term dates; "adapted study path using these materials", never "enrolled at MIT"; personal
certificates are informal records; bots, peers and faculty are labelled AI everywhere.
