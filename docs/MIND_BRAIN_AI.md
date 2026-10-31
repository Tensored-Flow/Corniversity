# Mind, Brain and AI update: requirements and coverage

The owner's in-place curriculum and programme update was applied to the existing application on
31 October 2026. The update arrived truncated: sections 1 to 12 were received in full, and the
text stopped at the heading of section 13 ("Product e…"). **Sections 13 onward were not received
and are not implemented**; nothing below claims them.

Each requirement is classified as *implemented*, *partial*, *present under another name*,
*missing* or *blocked*, with where it lives and what verifies it.

## 1. Applying the update

| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Inspect first and classify every requirement | implemented | this document | — |
| Preserve uncommitted work; no reset or clean | implemented | no reset, clean or force operation was run | git history |
| Preserve routes, content, learner records, database identifiers, enrolments and schedules | implemented | the programme keeps its id `mind-and-computation`; existing routes unchanged (new: `/programmes`, `/programmes/[id]`); course content is versioned by hash; the owner's explicit term rhythm is kept | seed-idempotence test; study test "an earlier explicit choice is preserved" |
| Additive, versioned migrations; no destructive reseed | implemented | `packages/db/drizzle/0003_mind-brain-ai-and-study-defaults.sql` adds two tables and five columns | seed-idempotence test: a second seed creates nothing and keeps enrolments and participation |
| Stable mapping to the new identifiers | implemented | `programme.reference_id` = `MIND-BRAIN-AI` for `mind-and-computation`; `getProgramme` accepts either | programmes test |
| No purchases, paid upgrades, unbounded model calls, bulk downloads, public exposure, or changes to unrelated projects | implemented | fixture provider only; Psych-101 (about 859 MB) not downloaded; nothing deployed; Kalibr untouched | — |

## 2. What is preserved

| Requirement | Status | Verified by |
|---|---|---|
| Six departments; mathematics, physics and chemistry depth | implemented | validator |
| The twelve launch courses, all `teaching_ready` | implemented | validator: launch 12, teaching_ready 12 |
| All original requirements | implemented | the full unit, integration and journey suites (see QA_REPORT.md) |

Two launch courses changed additively: CSA-210 and NEU-220 predictive exercises now state their
information contract, and NEU-220's tuning laboratory holds out trials of every orientation (see
*Repairs* below). Both are new course versions; nothing was removed.

## 3. The programme

| Requirement | Status | Where | Verified by |
|---|---|---|---|
| A first-class programme MIND-BRAIN-AI, "Mind, Brain and AI", across cognitive science, neuroscience and computer science | implemented | `content/programmes/mind-and-computation.json` | validator; seed test |
| Selectable in onboarding | implemented | orientation, interests step; confirming follows the chosen programmes | programmes test (following with source `onboarding`); the orientation screen itself is not exercised by a journey |
| Discoverable in a programme catalogue | implemented | `/programmes`, linked from the course catalogue | journey spec 09 |
| Inspectable before enrolment | implemented | `/programmes/[id]`: blocks with derived readiness, shelves, methods, electives, seminar | journey spec 09 |
| Editable by the director through proposals | present under another name | the director drafts a route for the learner (focus blocks and suggested courses) that the learner confirms or rejects; the programme's own text is versioned content, edited in `content/` | seed test; journey spec 09 |
| Visible in the academic map | implemented | My Studies, programme map (blocks, focus, methods) | journey spec 09 |
| Several programmes at once; following never enrols | implemented | `programme_participation` | programmes test; seed test; journey spec 09 |
| Blocks are not duplicate courses; a unit serving several blocks is read once and assessed once | implemented | `programmeWorkItems`; the programme page lists shared units | progress tests; seed test (COG-260 unit 1 is one work item for MBI-04, MBI-06 and MBI-11); journey spec 09 |

## 4. Study defaults

| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Rolling self-paced study; one main course; up to one exploratory course; weekly appointments on; hard deadlines off; examinations off | implemented | `packages/core/src/planning/preferences.ts` | study and planning tests |
| Formal terms optional | implemented | rhythm `term` or `reading_course` by explicit choice | study test |
| A heavier load only after a workload preview | implemented | preference changes and enrolment both require the preview | study test; journey spec 09 takes two courses through the preview |
| No automatic completion deadline | implemented | the term row is a rolling planning window, extended by proposal | study test; planning tests |
| Enrolment always explicitly confirmed | implemented | only the course page enrols; following and confirmed routes enrol nothing | seed test; journey spec 09 |
| Earlier explicit preferences are not overwritten | implemented | only explicit choices are stored; the older rhythm field counts as explicit | study test |
| Content sequence, study appointments and academic deadlines kept separate | implemented | Timetable, obligations panel | journey spec 09 |
| A missed appointment is no penalty; term mode does not switch on examinations; a timetable creates no deadline | implemented | `packages/core/src/planning/obligations.ts` | planning tests; study test |

## 5 and 6. Blocks and their specifications

| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Blocks MBI-01 to MBI-12 mapped to the named courses | implemented | programme file | validator |
| Each block states its central question, entry level, coverage, bridges, source shelf, mappings, activities, evidence and gaps; readiness is derived, never authored | implemented | programme file; `packages/core/src/programme/progress.ts` | validator; progress tests; seed test |
| At least one reviewed, source-mapped unit for COG-250 and one for COG-260 | implemented | COG-250 unit 1, *Planning strategies and transfer*; COG-260 unit 1, *Building and checking a model of choice behaviour*; both with laboratories, three exercises, instructor reasoning and recorded checks, and an independent review pass | validator; seed test; journey spec 09; QA_REPORT.md |
| Every predictive exercise states its ten-point information contract | implemented | the new units; CSA-210 unit 1 exercises 1 and 2; NEU-220 unit 2 exercise 3 and unit 3 exercise 2 | content review; not enforced by the validator |

The independent review of both units, its findings and their repairs are recorded in
[QA_REPORT.md](QA_REPORT.md).

The ten points: observed; prediction target; history in training; history at inference; person;
task; later time periods; unavailable in real use; simplest baseline; claims not tested. The
laboratory shows the same ten labels.

Block readiness, derived from the catalogue on 31 October 2026: MBI-01, MBI-04, MBI-05, MBI-06,
MBI-07, MBI-08, MBI-09 and MBI-11 are partly prepared (prepared units sit beside outlined units
or courses still to be refined); MBI-03 has verified sources but no prepared mapped unit; MBI-02,
MBI-10 and MBI-12 are proposed. COG-250 and COG-260 are `source_verified`, each with one prepared
unit and seven outlined units.

## 7. Electives

| Requirement | Status | Verified by |
|---|---|---|
| COG-310, COG-320, COG-330, COG-340, NEU-310, CSA-310, CSA-320 and COG-350, proposed and offered for audit only | implemented | validator |
| Nobody is enrolled automatically | implemented | seed test |

## 8. Catalogue baseline

| Requirement | Status | Verified by |
|---|---|---|
| Twelve records appended to reach 86 courses, with the same twelve launch flags | implemented | validator: 86 courses, 12 launch |
| Idempotent seeding | implemented | seed-idempotence test |

## 9. Modelling methods

| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Methods 9.1 to 9.8 explicit | implemented | programme `methods`, each tied to a concept and to units with a role | validator |
| Introduced, practised and demonstrated shown separately | implemented | programme page and map show the learner's state per method and which prepared units carry it | progress tests; seed test |

Prepared coverage: COG-260 unit 1 practises or assesses 9.1 to 9.5 and 9.7; COG-250 unit 1
introduces 9.7 and practises 9.8; COG-201 unit 1 introduces 9.8 and unit 2 introduces 9.1;
NEU-220 unit 2 practises 9.2 and 9.5; CSA-210 unit 1 practises 9.5 and 9.7. 9.6 (measurement,
reliability and validity) has no prepared unit yet and is shown as planned. Each of these units
carries its method concepts, so completing its reading introduces them and an assessed exercise
practises them; the learner's state per method moves only on that evidence.

## 10. The modelling loop

COG-260 unit 1 with the `choice-model-loop` laboratory (`packages/core/src/labs/choice-models.ts`).

| Element | Where |
|---|---|
| Question and task | a two-armed bandit; an informative and an ambiguous case |
| Competing models | biased responding (baseline), noisy win-stay lose-shift, Rescorla-Wagner with softmax |
| Prediction stage | results hidden until a prediction is saved to the notebook (it records no evidence) |
| Simulator | deterministic in its seed; synthetic and labelled |
| Fitting | maximum likelihood (closed forms for two models; grid and refinement for Rescorla-Wagner) |
| Parameter recovery | per setting, with correlations and biases |
| Model recovery | confusion matrix by BIC |
| Validation by simulation | model-independent measures for the participant beside those of 20 sessions simulated from the winning model |
| Held-out comparison and baseline | three splits, each with its contract shown before it is run; one deliberately leaking |
| Report, tutor feedback and revision | exercise 3 through the assessment workflow |
| Ambiguous case | a short session, close arms and participants whose choices barely depend on learned values; design controls let each be changed separately, and the case is reported as inconclusive |

Deterministic tests: `choice-models.test.ts`. Synthetic data never enter the academic record;
nothing in the account was invented.

## 11. Frontier candidates

All ten resolved to verified records (`content/sources/`), with their ambiguities recorded.

| Candidate | Record | Recorded ambiguity |
|---|---|---|
| Gureckis, computational cognitive modelling | `gureckis-ccm-2026`, `lake-gureckis-ccm-2024` | the 2026 course is in progress and its notes are marked draft |
| Wilson and Collins, ten rules | `wilson-collins-2019-ten-rules` | rules unnumbered; text and code differ on initial values, the update rule and the BIC formula |
| Gershman | `gershman-cfcn` | a draft textbook whose files change in place; only three chapters read |
| Kanwisher | `mit-human-brain-2019` | eight lectures without recording or notes; none watched |
| Prince, *Understanding Deep Learning* | `prince-udl` | chapters checked at their opening pages only |
| Hedge, Powell and Sumner | `hedge-2018-reliability-paradox` | supplementary material not opened |
| Centaur | `binz-centaur-2025`, `psych-101` | the summary's claim outruns one non-significant panel; critiques listed |
| Oh and Gobet | `oh-gobet-small-foundation-models` | identified from authors and topic; COLM publication not checked |
| DeepSeek-R1 | `deepseek-r1` | benchmark numbers not checked; the arXiv version grants no reuse |
| DreamerV3 | `hafner-dreamerv3` | preprint and published text not compared |

The paper seminar holds six papers within a bound of eight.

## 12. Missing sources

| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Missing sources go through the existing library workflow and request process | implemented | leads named by courses on a followed programme appear in Library, Books to obtain, labelled as leads with no citation; adding one uses the existing request list | seed test |

## Repairs made along the way

- The choice-model laboratory's held-out comparison in the ambiguous case drew participants from
  the broad region; it now uses the case's own region (test added).
- The tuning laboratory held out two fixed orientations instead of trials of every orientation,
  so its "held-out" comparison was an extrapolation test; it now holds out every fourth
  repetition of each orientation (test added). The instructor's quoted margin was corrected from
  an estimate of 0.5 to 1 nats to the computed 11.9 nats per trial.
- The journey helper that takes a course never completed an enrolment that needed the workload
  preview; it now waits for the enrolment itself.
- The catalogue counted only teaching-ready courses as having prepared units; it now also counts
  courses with a first prepared unit.
- The methods table listed NEU-220 unit 2 as introducing model recovery, which it does not teach;
  the mapping was removed. The earlier units mapped to methods carried no method concepts, so a
  learner's method state could never move through them; they now do.
