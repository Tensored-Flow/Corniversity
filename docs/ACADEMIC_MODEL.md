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

## Workload and timetable

Term template: ten teaching weeks + reading week + synthesis week (editable). Units are content,
not calendar weeks. Workload estimates are ranges including reading, problems, practice and
projects. Default first term: one demanding core course plus a lighter seminar; heavier loads
require an explicit workload preview.

## Honesty rules

No invented sources, chapters or exercise numbers; external course dates separate from personal
term dates; "adapted study path using these materials", never "enrolled at MIT"; personal
certificates are informal records; bots, peers and faculty are labelled AI everywhere.
