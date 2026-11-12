# Mind, Brain and AI update: requirements and coverage

The owner's in-place curriculum and programme update was applied to the existing application on
31 October 2026. The update arrived truncated after section 12; sections 13 to 20 arrived as a
separate continuation on 9 November 2026 and are reconciled in the last part of this document.

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
| No purchases, paid upgrades, unbounded model calls, bulk downloads, public exposure, or changes to unrelated projects | implemented | scripted demo only (no paid model use); Psych-101 (about 859 MB) not downloaded; deployed only to the owner's existing private Railway project; Kalibr untouched | — |

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

## Coverage by block, elective, method and source

Generated from the catalogue by `pnpm content:coverage`; a test fails when these tables no longer
match it. Readiness is derived exactly as the application derives it. "Prepared" describes
teaching material, never what a learner has understood, and a partly prepared block can still map
courses that are only proposed.

<!-- coverage:start (generated by `pnpm content:coverage`; do not edit by hand) -->

### Blocks

Location is the block's page; the block itself lives in `content/programmes/mind-and-computation.json`.

| Block | Location | Courses and units | Sources and locators | Readiness (derived) | Remaining gap | Evidence |
|---|---|---|---|---|---|---|
| MBI-01 Explaining Minds and Brains | `/programmes/mind-and-computation/blocks/MBI-01` | COG-100: no unit chosen; COG-201: COG-201-u01 (ready); NEU-220: NEU-220-u01 (ready) | spine `blokpoel-vanrooij-theoretical-modeling`; 6 more verified records; no leads; COG-201-u01 cites 27 verified locators; NEU-220-u01 cites 6 verified locators | Partly prepared: some mapped units can be studied | COG-100 has no prepared unit; prepared units in COG-201 and NEU-220 cover part of the ground. What makes something a representation is not treated head-on (deliberately: no philosophy reading list). Units still to choose in COG-100. | validator (mappings, shelf); progress tests (derivation); COG-201-u01 recorded checks 4 of 4 pass; NEU-220-u01 recorded checks 4 of 4 pass |
| MBI-02 Foundations of Neuroscience | `/programmes/mind-and-computation/blocks/MBI-02` | NEU-101: no unit chosen; NEU-201: no unit chosen | spine `neuroscience-online`; 4 more verified records; no leads | Proposed: no mapped course is sourced yet | Recording, imaging and perturbation methods and their limits have no dedicated verified source; MIT 9.13 was verified from its index pages and one lecture's slides, and no lecture was watched. The spine is reference-only, and neither canonical course has a prepared unit. Units still to choose in NEU-101, NEU-201. | validator (mappings, shelf); progress tests (derivation) |
| MBI-03 Cognitive Psychology | `/programmes/mind-and-computation/blocks/MBI-03` | COG-101: no unit chosen; COG-201: COG-201-u04 (draft) | spine `noba-psychology`; 2 more verified records; no leads | Sources verified for a mapped course; no unit prepared yet | No working-memory source yet (MIT 9.00SC and 9.65 were opened and are the next candidates); reasoning is thin; COG-101 has no prepared unit. Not yet prepared: COG-201-u04. Units still to choose in COG-101. | validator (mappings, shelf); progress tests (derivation) |
| MBI-04 Statistical Learning and Computational Inference | `/programmes/mind-and-computation/blocks/MBI-04` | CSA-201: no unit chosen; CSA-220: no unit chosen; COG-210: no unit chosen; NEU-220: NEU-220-u02 (ready); COG-201: COG-201-u02 (ready); CSA-210: CSA-210-u01 (ready); COG-260: COG-260-u01 (ready) | spine `bayes-rules`; 4 more verified records; no leads; NEU-220-u02 cites 7 verified locators; COG-201-u02 cites 44 verified locators; CSA-210-u01 cites 6 verified locators; COG-260-u01 cites 19 verified locators | Partly prepared: some mapped units can be studied | CSA-201, CSA-220 and COG-210 have no prepared unit; the block is taught today through mapped prepared units, including COG-260 unit 1. Identifiability is taught through parameter and model recovery (Wilson and Collins); formal identifiability analysis has no source yet. Units still to choose in CSA-201, CSA-220, COG-210. | validator (mappings, shelf); progress tests (derivation); NEU-220-u02 recorded checks 4 of 4 pass; COG-201-u02 recorded checks 4 of 4 pass; CSA-210-u01 recorded checks 5 of 5 pass; COG-260-u01 recorded checks 5 of 5 pass |
| MBI-05 Measurement and Experimental Design | `/programmes/mind-and-computation/blocks/MBI-05` | COG-210: no unit chosen; COG-220: no unit chosen; CSA-210: CSA-210-u01 (ready); COG-260: COG-260-u03 (draft) | spine `jhangiani-research-methods`; 4 more verified records; no leads; CSA-210-u01 cites 6 verified locators | Partly prepared: some mapped units can be studied | Longitudinal change (change scores, growth models, regression to the mean) has no source yet; invariance is covered only at an advanced level. Neither canonical course has a prepared unit, and the measurement method has no prepared unit. Not yet prepared: COG-260-u03. Units still to choose in COG-210, COG-220. | validator (mappings, shelf); progress tests (derivation); CSA-210-u01 recorded checks 5 of 5 pass |
| MBI-06 Learning and Decision-Making | `/programmes/mind-and-computation/blocks/MBI-06` | COG-230: no unit chosen; CSA-230: no unit chosen; COG-260: COG-260-u01 (ready); COG-250: COG-250-u01 (ready), COG-250-u02 (draft), COG-250-u05 (draft) | spine `sutton-barto-rl-2e`; 5 more verified records; no leads; COG-260-u01 cites 19 verified locators; COG-250-u01 cites 13 verified locators | Partly prepared: some mapped units can be studied | No verified source yet for choice models as statistical models (logit, random utility, sequential sampling). COG-230 and CSA-230 have no prepared unit; COG-260 unit 1 and COG-250 unit 1 carry the block's choice-learning and planning material today. Not yet prepared: COG-250-u02, COG-250-u05. Units still to choose in COG-230, CSA-230. | validator (mappings, shelf); progress tests (derivation); COG-260-u01 recorded checks 5 of 5 pass; COG-250-u01 recorded checks 5 of 5 pass |
| MBI-07 Neural Networks and Representations | `/programmes/mind-and-computation/blocks/MBI-07` | CSA-210: CSA-210-u01 (ready), CSA-210-u02 (ready), CSA-210-u03 (ready), CSA-210-u06 (ready), CSA-210-u09 (ready), CSA-210-u10 (ready) | spine `neuromatch-deep-learning`; 2 more verified records; no leads; CSA-210-u01 cites 6 verified locators; CSA-210-u02 cites 7 verified locators; CSA-210-u03 cites 2 verified locators; CSA-210-u06 cites 1 verified locator; CSA-210-u09 cites 1 verified locator; CSA-210-u10 cites 2 verified locators | Prepared: every mapped unit can be studied | CKA or CCA style representation comparison has no source yet. | validator (mappings, shelf); progress tests (derivation); CSA-210-u01 recorded checks 5 of 5 pass; CSA-210-u02 recorded checks 5 of 5 pass; CSA-210-u03 recorded checks 5 of 5 pass; CSA-210-u06 recorded checks 4 of 4 pass; CSA-210-u09 recorded checks 5 of 5 pass; CSA-210-u10 recorded checks 5 of 5 pass |
| MBI-08 Systems and Computational Neuroscience | `/programmes/mind-and-computation/blocks/MBI-08` | NEU-210: no unit chosen; NEU-220: NEU-220-u02 (ready), NEU-220-u03 (ready), NEU-220-u04 (ready), NEU-220-u06 (draft), NEU-220-u08 (draft) | spine `neuromatch-compneuro`; 4 more verified records; no leads; NEU-220-u02 cites 7 verified locators; NEU-220-u03 cites 3 verified locators; NEU-220-u04 cites 5 verified locators | Partly prepared: some mapped units can be studied | NEU-210 has no prepared unit; NEU-220 units 6 and 8 are outlined, not prepared; no population-dynamics reading beyond Neuromatch. Not yet prepared: NEU-220-u06, NEU-220-u08. Units still to choose in NEU-210. | validator (mappings, shelf); progress tests (derivation); NEU-220-u02 recorded checks 4 of 4 pass; NEU-220-u03 recorded checks 4 of 4 pass; NEU-220-u04 recorded checks 4 of 4 pass |
| MBI-09 Planning and Structured Cognition | `/programmes/mind-and-computation/blocks/MBI-09` | COG-250: COG-250-u01 (ready), COG-250-u02 (draft), COG-250-u03 (draft), COG-250-u04 (draft), COG-250-u05 (draft), COG-250-u06 (draft), COG-250-u07 (draft), COG-250-u08 (draft) | spine `sutton-barto-rl-2e`; 5 more verified records; no leads; COG-250-u01 cites 13 verified locators | Partly prepared: some mapped units can be studied | COG-250 unit 1 is prepared and units 2 to 5 and 8 are outlined with verified sources; hierarchical and compositional representations, analogy and relational reasoning have no verified source yet. Not yet prepared: COG-250-u02, COG-250-u03, COG-250-u04, COG-250-u05, COG-250-u06, COG-250-u07, COG-250-u08. | validator (mappings, shelf); progress tests (derivation); COG-250-u01 recorded checks 5 of 5 pass |
| MBI-10 Modern AI | `/programmes/mind-and-computation/blocks/MBI-10` | CSA-250: no unit chosen; CSA-270: no unit chosen; CSA-230: no unit chosen | spine `jurafsky-martin-slp3`; 4 more verified records; no leads | Proposed: no mapped course is sourced yet | None of the three canonical courses has a prepared unit; contamination and distribution shift are covered only by CS336's evaluation lecture. Units still to choose in CSA-250, CSA-270, CSA-230. | validator (mappings, shelf); progress tests (derivation) |
| MBI-11 Models of Human Behaviour and NeuroAI | `/programmes/mind-and-computation/blocks/MBI-11` | COG-260: COG-260-u01 (ready), COG-260-u02 (draft), COG-260-u03 (draft), COG-260-u04 (draft), COG-260-u05 (draft), COG-260-u06 (draft), COG-260-u07 (draft), COG-260-u08 (draft); NEU-230: no unit chosen | spine `neuromatch-neuroai`; 5 more verified records; no leads; COG-260-u01 cites 19 verified locators | Partly prepared: some mapped units can be studied | NEU-230 has no prepared unit, and the plasticity-as-optimisation chapter of Gershman's draft textbook is known by title only. COG-260 unit 1 is prepared; units 2 to 8 are outlined, and unit 8's privacy and application-claims coverage has no verified source yet. Not yet prepared: COG-260-u02, COG-260-u03, COG-260-u04, COG-260-u05, COG-260-u06, COG-260-u07, COG-260-u08. Units still to choose in NEU-230. | validator (mappings, shelf); progress tests (derivation); COG-260-u01 recorded checks 5 of 5 pass |
| MBI-12 Independent Research Studio | `/programmes/mind-and-computation/blocks/MBI-12` | COG-290: no unit chosen | spine `turing-way`; 2 more verified records; no leads | Proposed: no mapped course is sourced yet | No source yet on reporting negative results or on notebook practice. Units still to choose in COG-290. | validator (mappings, shelf); progress tests (derivation) |

### Electives

| Elective | Location | Connects to | Readiness | Sources | Remaining gap | Evidence |
|---|---|---|---|---|---|---|
| COG-310 Affect and Motivation | `/courses/COG-310` | MBI-03, MBI-06, MBI-11 | proposed; offered for audit | 0 verified records; 0 leads | No prepared unit. Resolve a primary source on effort allocation and one on affective influences on choice; prepare a first unit around comparing explanations of an effort-allocation result. | validator; seed test (no automatic enrolment) |
| COG-320 Metacognition | `/courses/COG-320` | MBI-03, MBI-05, MBI-06 | proposed; offered for audit | 0 verified records; 0 leads | No prepared unit. Resolve a primary source on metacognitive sensitivity and calibration measures and a permitted dataset with confidence ratings; prepare a first unit around the analysis activity below. | validator; seed test (no automatic enrolment) |
| COG-330 Social and Multiplayer Cognition | `/courses/COG-330` | MBI-06, MBI-09, MBI-11 | proposed; offered for audit | 0 verified records; 0 leads | No prepared unit. Resolve a primary source on theory-of-mind models (for example inverse planning) and one on coordination games; prepare a first unit around the comparison activity below. | validator; seed test (no automatic enrolment) |
| COG-340 Advanced Psychometrics | `/courses/COG-340` | MBI-05, MBI-11 | proposed; offered for audit | 0 verified records; 0 leads | No prepared unit. Choose a primary text after reviewing open and commercial options; prepare a first unit comparing two measurement models on a permitted dataset. | validator; seed test (no automatic enrolment) |
| NEU-310 Neural Dynamics | `/courses/NEU-310` | MBI-02, MBI-08 | proposed; offered for audit | 0 verified records; 0 leads | No prepared unit. Reuse the Neuromatch dynamical-systems days already registered for NEU-220 as the spine once their units are prepared; add one population-dynamics source after verification. | validator; seed test (no automatic enrolment) |
| CSA-310 Interpretability | `/courses/CSA-310` | MBI-07, MBI-10, MBI-11 | proposed; offered for audit | 0 verified records; 0 leads | No prepared unit. Resolve primary sources for two contrasting method families (for example probing and causal intervention) with stated limitations; prepare a first unit on a modest model. | validator; seed test (no automatic enrolment) |
| CSA-320 Learning to Learn | `/courses/CSA-320` | MBI-06, MBI-07, MBI-10 | proposed; offered for audit | 0 verified records; 0 leads | No prepared unit. Resolve one primary meta-learning source and one on task-split construction; prepare a first unit around the evaluation activity below. | validator; seed test (no automatic enrolment) |
| COG-350 Consciousness | `/courses/COG-350` | MBI-01, MBI-02, MBI-08 | proposed; offered for audit | 0 verified records; 0 leads | No prepared unit. Resolve a small, balanced reading list (two theories with stated empirical commitments and one adversarial-collaboration or comparison paper); run it as a bounded seminar. | validator; seed test (no automatic enrolment) |

### Modelling methods

Location: the programme's `methods`, shown on the programme page and the programme map.

| Method | Units and roles | Readiness | Remaining gap | Evidence |
|---|---|---|---|---|
| 9.1 Generative-model design and simulation | COG-201-u02 introduces (ready); COG-260-u01 practises (ready) | carried by 2 prepared units | COG-260: Unit 2 (outlined): free simulation of fitted models. | validator (each unit teaches the method's concept); progress tests (the learner's state moves only on evidence); COG-201-u02 recorded checks 4 of 4 pass; COG-260-u01 recorded checks 5 of 5 pass |
| 9.2 Parameter estimation and uncertainty | NEU-220-u02 practises (ready); COG-260-u01 practises (ready) | carried by 2 prepared units | COG-260: Unit 3 (outlined): what a fitted parameter measures. | validator (each unit teaches the method's concept); progress tests (the learner's state moves only on evidence); NEU-220-u02 recorded checks 4 of 4 pass; COG-260-u01 recorded checks 5 of 5 pass |
| 9.3 Parameter recovery | COG-260-u01 assesses (ready) | carried by 1 prepared unit | None recorded. | validator (each unit teaches the method's concept); progress tests (the learner's state moves only on evidence); COG-260-u01 recorded checks 5 of 5 pass |
| 9.4 Model recovery and model comparison | COG-260-u01 assesses (ready) | carried by 1 prepared unit | None recorded. | validator (each unit teaches the method's concept); progress tests (the learner's state moves only on evidence); COG-260-u01 recorded checks 5 of 5 pass |
| 9.5 Predictive and simulation checks | CSA-210-u01 practises (ready); NEU-220-u02 practises (ready); COG-260-u01 practises (ready) | carried by 3 prepared units | COG-260: Unit 2 (outlined): validation by simulation. | validator (each unit teaches the method's concept); progress tests (the learner's state moves only on evidence); CSA-210-u01 recorded checks 5 of 5 pass; NEU-220-u02 recorded checks 4 of 4 pass; COG-260-u01 recorded checks 5 of 5 pass |
| 9.6 Measurement reliability and validity | none | planned only | No prepared unit. COG-220: Psychometrics and measurement (proposed). COG-210: Experimental design (proposed). COG-260: Unit 3 (outlined): reliability and generalisation of fitted parameters. | validator (each unit teaches the method's concept); progress tests (the learner's state moves only on evidence) |
| 9.7 Longitudinal and transfer evaluation | CSA-210-u01 practises (ready); COG-260-u01 practises (ready); COG-250-u01 introduces (ready) | carried by 3 prepared units | COG-260: Unit 4 (outlined): held-out people, tasks and later sessions. | validator (each unit teaches the method's concept); progress tests (the learner's state moves only on evidence); CSA-210-u01 recorded checks 5 of 5 pass; COG-260-u01 recorded checks 5 of 5 pass; COG-250-u01 recorded checks 5 of 5 pass |
| 9.8 Scientific argument from models | COG-201-u01 introduces (ready); COG-250-u01 practises (ready) | carried by 2 prepared units | COG-260: Units 6 to 8 (outlined): foundation models, ablations and warranted claims. | validator (each unit teaches the method's concept); progress tests (the learner's state moves only on evidence); COG-201-u01 recorded checks 4 of 4 pass; COG-250-u01 recorded checks 5 of 5 pass |

### Sources on the block shelves

36 verified records on the shelves and 3 leads awaiting resolution (below). A record holds what was opened and what was not; a bibliographic entry alone is not a review, and each record's limitations say what was not checked.

| Source | Version inspected | Verified | What was seen | Access and processing | Limitations | Shelves |
|---|---|---|---|---|---|---|
| `bayes-rules` | Online edition (build dated 2021-12-01 on the home page) | 2026-10-31 by Claude (research agent): opened the home page (contents), the preface (licence, audience, software) and Chapters 1, 10 and 15 | 5 components listed in the record | open; import allowed | 4 limitations recorded | MBI-04 spine |
| `binz-centaur-2025` | arXiv:2410.20268v3 (28 April 2025), 'Centaur: a foundation model of human cognition' (v1 26 October 2024; v2 18 November 2024) | 2026-10-31 by Claude (research agent): opened the arXiv abstract page (versions, licence) and the v3 HTML (first 100,000 of about 169,000 characters, for the section structure); parsed the v3 PDF (149 pages) in memory to locate section pages | 3 components listed in the record | open; import allowed | 2 limitations recorded | MBI-11 supplement |
| `blokpoel-vanrooij-theoretical-modeling` | Online edition (© 2025; citation dated 2021-2025; no version number; viewed 2026-10-31) | 2026-10-31 by Claude (research agent): opened the home page (contents and licence), Chapter 1 Introduction and Chapter 2 Conceptual foundations | 3 components listed in the record | open; import allowed | 4 limitations recorded | MBI-01 spine |
| `cruwell-evans-2021` | Published article, Royal Society Open Science 8(10): 210155 (13 October 2021), PMC8511762 | 2026-10-31 by Claude (research agent): opened the PMC full-text page (metadata, licence, headings) and PMC's copyright notice; the publisher page returned HTTP 403 | 3 components listed in the record | open; no import | 3 limitations recorded | MBI-12 supplement |
| `daw-2011-model-based-influences` | Author manuscript NIHMS280176 in PubMed Central, PMC3077926 (available in PMC 24 March 2012); published in final edited form as Neuron 69(6):1204-1215, 24 March 2011 | 2026-10-31 by Claude (research agent): opened the PMC article page and its JATS XML through NCBI E-utilities, the Crossref record and the PMC Copyright Notice; the publisher page and the supplement could not be opened | 3 components listed in the record | open; no import | 5 limitations recorded | MBI-09 supplement |
| `deepseek-r1` | Nature 645(8081), 633–638 (2025); received 14 February 2025, accepted 17 July 2025, published 17 September 2025, issue date 18 September 2025 | 2026-10-31 by Claude (research agent): read the article on nature.com after its cookie redirect ('Open access' label, 'Rights and permissions', 'About this article') and the PMC copy PMC12443585 (the first 100,000 of about 105,000 characters: summary, section headings, data and code availability); opened nature.com's Website Terms and the PMC copyright page | 3 components listed in the record | open; no import | 3 limitations recorded | MBI-10 supplement |
| `dezfouli-2019-models-that-learn` | PLoS Computational Biology 15(6): e1006903, published 11 June 2019 | 2026-10-31 by Claude (research agent): opened the PLOS article page (copyright line, data statement, anchors) and the PLOS article XML (metadata, permissions, abstract, structure and four sections), and the Crossref record | 3 components listed in the record | open; import allowed | 3 limitations recorded | MBI-06 supplement |
| `eckstein-2022-parameter-context` | eLife 11:e75474, published 4 November 2022 | 2026-10-31 by Claude (research agent): opened the eLife article page (anchors) and its JATS XML (metadata, permissions, abstract, structure and four sections), and the Crossref record | 2 components listed in the record | open; import allowed | 3 limitations recorded | MBI-05 supplement |
| `fischer-karl-2019` | Published article, Frontiers in Psychology 10:1507 (18 July 2019) | 2026-10-31 by Claude (research agent): opened the full-text article page on frontiersin.org (headings, copyright section, citation line) | 3 components listed in the record | open; import allowed | 3 limitations recorded | MBI-05 supplement |
| `flake-fried-2020` | Published article (author-hosted PDF; pages 1-10; received 1/17/19, revision accepted 6/21/20) | 2026-10-31 by Claude (research agent): opened the author's publications page (entry 102) and extracted the text of the author-hosted PDF locally with the Corniversity scripts/pdf-dump.ts | 4 components listed in the record | open_restricted_reuse; no import | 3 limitations recorded | MBI-05 supplement |
| `gershman-cfcn` | Draft, 'Last update: 10/05/2026' as printed on the textbook page (opened 2026-10-31) | 2026-10-31 by Claude (research agent): opened the textbook, lectures, mini-projects and code pages and searched their HTML for licence text; extracted the text of chapter1.pdf (15 pages), chapter4.pdf (22 pages), chapter10.pdf (20 pages) and lectures/lecture1.pdf (78 pages); opened the GitHub repository sjgershm/CFCN and its LICENSE | 6 components listed in the record | open; import allowed | 6 limitations recorded | MBI-01 supplement, MBI-06 supplement, MBI-08 supplement, MBI-09 optional |
| `gureckis-ccm-2026` | Fall 2026 offering, live site (course-note chapters marked DRAFT; chapter 'Updated' dates seen: October 1, 26 and 30, 2026) | 2026-10-31 by Claude (research agent): opened the home page, syllabus, schedule, licence page, course-videos page and retrieving-homework page; the course-note pages Minds and Machines, Introduction to Reinforcement Learning and Inductive Inference and Bayesian Models of Cognition (the last two truncated by the fetcher); the teaching index at www.gureckislab.org/teaching; the GitHub repository gureckis/CCM-public, its LICENSE and its labs/ listing; and checked the HTTP status of one lab slide deck | 8 components listed in the record | open; import allowed | 5 limitations recorded | MBI-01 supplement |
| `hafner-dreamerv3` | arXiv:2301.04104v2 (17 April 2024; v1 10 January 2023), 'Mastering Diverse Domains through World Models' | 2026-10-31 by Claude (research agent): opened the arXiv abstract page and the v2 HTML (main text; the Methods appendix did not render beyond 'Baselines'); parsed the v2 PDF (40 pages) in memory to locate section pages | 3 components listed in the record | open; import allowed | 2 limitations recorded | MBI-10 supplement |
| `hedge-2018-reliability-paradox` | Behavior Research Methods 50(3), 1166-1186 (publication date 2018/06 in the Springer metadata); published online 19 July 2017 | 2026-10-31 by Claude (research agent): opened the Springer article page (citation metadata, rights statement, section anchors), the PMC copy PMC5990556 (page, licence panel, anchors) and its JATS XML through NCBI E-utilities, the PMC Copyright Notice and the Crossref record | 3 components listed in the record | open; import allowed | 4 limitations recorded | MBI-05 supplement |
| `huys-2012-bonsai-trees` | PLoS Computational Biology 8(3): e1002410, published 8 March 2012 (received 14 September 2011, accepted 18 January 2012) | 2026-10-31 by Claude (research agent): opened the PLOS article page (copyright line, anchors) and the PLOS article XML (metadata, permissions, abstract, structure, Methods sections and figure captions) and the Crossref record | 4 components listed in the record | open; import allowed | 3 limitations recorded | MBI-09 supplement |
| `jhangiani-research-methods` | LibreTexts remix of the KPU fourth edition (book page last modified 15 Aug 2024) | 2026-10-31 by Claude (research agent): opened the LibreTexts book page, the Chapter 4 and Chapter 5 index pages, Sections 4.3 and 5.3, and the LibreTexts terms of service | 5 components listed in the record | open; import allowed | 4 limitations recorded | MBI-05 spine |
| `jonas-kording-2017` | Published version, PLOS Computational Biology 13(1): e1005268 (January 12, 2017) | 2026-10-31 by Claude (research agent): opened the article page on journals.plos.org (metadata, copyright statement, abstract, section headings) | 4 components listed in the record | open; import allowed | 3 limitations recorded | MBI-01 supplement, MBI-02 supplement |
| `jurafsky-martin-slp3` | 3rd edition draft, August 19, 2026 release | 2026-10-31 by Claude (research agent): opened the book page (release line, chapter list, permission sentence) and extracted the text of the Chapter 7 and Chapter 8 PDFs locally with the Corniversity scripts/pdf-dump.ts | 3 components listed in the record | open_restricted_reuse; no import | 5 limitations recorded | MBI-10 spine |
| `lake-gureckis-ccm-2024` | Spring 2024 offering (archived; most recent repository commit 2 May 2024, 'update link') | 2026-10-31 by Claude (research agent): opened the course site, the GitHub repository page, README.md, LICENSE, previous_videos.md, the homeworks/ folder page, API listings of homeworks/, homeworks/homework-NeuralNet and slides/, and the most recent commit record; extracted the text of slides/lecture-09-modelfit.pdf (80 pages) in memory | 7 components listed in the record | open; import allowed | 5 limitations recorded | MBI-04 optional |
| `mit-cocosci-2004` | Fall 2004 (OCW publication) | 2026-10-30 by Claude (content author agent) — opened the course, syllabus, calendar, lecture-notes, readings, projects and study-materials pages; confirmed all 24 lecture resource pages return HTTP 200 and extracted text from seven lecture PDFs with scripts/pdf-dump.ts | 6 components listed in the record | open; import allowed | 5 limitations recorded | MBI-01 supplement, MBI-03 supplement |
| `mit-human-brain-2019` | Spring 2019 (OCW publication; footer © 2001–2026 Massachusetts Institute of Technology) | 2026-10-31 by Claude (research agent): opened the course home, syllabus, calendar, readings, lecture videos, lecture notes, assignments, Assignment 1, Experimental Design Assignment, Instructor Insights and Lecture 1 resource pages, the Lecture 2 notes resource page and the OCW terms of use; extracted the text of the Lecture 2 notes PDF (19 pages) | 8 components listed in the record | open; import allowed | 5 limitations recorded | MBI-01 optional, MBI-02 supplement |
| `mit-neural-computation-2018` | Spring 2018 (OCW publication) | 2026-10-31 by Claude (research agent): opened the course home, syllabus, lecture-notes index, lecture-videos gallery, the Lecture 1 notes resource page and the Lecture 4 video page | 4 components listed in the record | open; import allowed | 4 limitations recorded | MBI-02 supplement, MBI-08 supplement |
| `neuromatch-compneuro` | Course book as published online (repository syllabus dated July 7–25, 2025; book marked 'under continuous development'; viewed 2026-10-30) | 2026-10-30 by Claude (content agent) — opened the introduction, general schedule, prerequisites page, 15 chapter pages and 16 tutorial pages of the book, plus the GitHub README, LICENSE.md and LICENSE-CODE.md | 6 components listed in the record | open; import allowed | 5 limitations recorded | MBI-01 supplement, MBI-02 supplement, MBI-04 supplement, MBI-06 supplement, MBI-08 spine |
| `neuromatch-deep-learning` | Online ebook, rolling publication (opened 2026-10-30) | 2026-11-12 by Claude (content author agent) — opened the introduction, schedule, prerequisites, every cited chapter page and tutorial page with WebFetch, and checked every cited URL returned HTTP 200 with the stated title; extended by Codex author and independent reviewers on 2026-11-12, with exact read scope in course manifests and quality-loop ledgers | 7 components listed in the record | open; import allowed | 5 limitations recorded | MBI-07 spine |
| `neuromatch-neuroai` | Course book as published online (MyST build; repository syllabus dated July 14-25, 2025; marked 'under continuous development'; viewed 2026-10-31) | 2026-10-31 by Claude (research agent): opened the book landing page, the general schedule, the prerequisites page, W1D1 Tutorial 1, W1D2 Tutorial 1 and W1D3 Tutorials 1-3, plus the GitHub README, the tutorials/ folder listing, tutorials/materials.yml, prereqs/NeuroAI.md, tutorials/Schedule/daily_schedules.md, LICENSE.md and LICENSE-CODE.md | 8 components listed in the record | open; import allowed | 6 limitations recorded | MBI-07 supplement, MBI-08 supplement, MBI-11 spine |
| `neuroscience-online` | Online edition (home page 'Last Revision or Edit: 13 January 2026'; chapters carry their own revision dates; viewed 2026-10-31) | 2026-10-31 by Claude (research agent): opened the home page, the table of contents, Section 1 Chapters 1 and 7 and Section 2 Chapter 1, and an alternative /neuroscience/m/ rendering of Section 1 Chapter 1 | 5 components listed in the record | open_restricted_reuse; no import | 4 limitations recorded | MBI-02 spine, MBI-08 supplement |
| `noba-psychology` | Modules as published online (module citations dated 2026; '© 2026 Diener Education Fund'; viewed 2026-10-31) | 2026-10-31 by Claude (research agent): opened the home page, the browse-content catalogue, the licence agreement and the modules Attention, Memory (Encoding, Storage, Retrieval) and Categories and Concepts | 6 components listed in the record | open; import allowed | 5 limitations recorded | MBI-03 spine |
| `oh-gobet-small-foundation-models` | arXiv:2608.05224v3 (11 August 2026; v1 5 August, v2 9 August 2026); pages headed 'Published as a conference paper at COLM 2026' | 2026-10-31 by Claude (research agent): opened the arXiv abstract page and the v3 HTML (the first 200,000 of about 220,000 characters); parsed the v3 PDF (87 pages) in memory for the abstract, Methods, the out-of-distribution section, the Reproducibility Statement and section pages; opened the GitHub repository socius-org/Centauri and its LICENSE, and the Hugging Face collection socius/centauri | 7 components listed in the record | open; import allowed | 4 limitations recorded | MBI-11 supplement |
| `prince-udl` | Free PDF dated 'February 8, 2026' on its title page (GitHub release v5.0.3 'Understanding Deep Learning Chapters 1-21', published 2026-02-09; site link 'Download full PDF (09 Feb 2026)') | 2026-10-31 by Claude (research agent): read the deployed book site's script bundle for its PDF link; the site source components HeroSection and Notebooks; the GitHub repository page, release list and root LICENSE; the Notebooks folder listing, its 'LICENSE (MIT)' and Info.txt; notebook 1.1; parsed the v5.0.3 PDF in memory (title page, contents, outline, page labels and 17 chapter-opening pages) and the v5.0.2 PDF (title page, outline and 13 pages) | 6 components listed in the record | open; import allowed | 6 limitations recorded | MBI-07 supplement, MBI-10 optional |
| `probmods-v2` | 2nd edition, web (cited as 2016; server Last-Modified 2023-06-05; opened 2026-10-30) | 2026-10-30 by Claude (content author agent) — opened the index and 13 chapter pages over HTTP (each HTTP 200 with the stated title and h1 headings) and read the chapter sources and _config.yml in the probmods/probmods2 repository | 3 components listed in the record | open_restricted_reuse; no import | 5 limitations recorded | MBI-03 supplement, MBI-04 supplement, MBI-06 supplement, MBI-09 optional, MBI-11 supplement |
| `psych-101` | Hugging Face dataset as listed on 2026-10-31 (one 'train' split, 60,092 rows, 859 MB; no version tag shown) | 2026-10-31 by Claude (research agent): opened the dataset card marcelbinz/Psych-101 and the card of the gated test set marcelbinz/Psych-101-test | 2 components listed in the record | open; no import | 4 limitations recorded | MBI-11 optional |
| `stanford-cs336` | Spring 2026 offering (course page; Assignment 1 handout 'Version 26.0.3', 'CS336 Staff', 'Spring 2026') | 2026-10-31 by Claude (research agent): opened the course page (links, prerequisites wording, schedule), the assignment1-basics repository page and its LICENSE, the lectures repository page, the Assignment 1 handout PDF (text extracted locally with the Corniversity scripts/pdf-dump.ts), and the lecture_01.py and lecture_12.py sources; the interactive lecture trace viewer returned no text | 8 components listed in the record | open_restricted_reuse; no import | 6 limitations recorded | MBI-10 supplement |
| `sutton-barto-rl-2e` | Second edition (MIT Press, 2018), author-hosted full PDF RLbook2020.pdf: copyright page '© 2018, 2020'; 548 PDF pages; PDF creation date 2022-04-26 (server Last-Modified 26 Apr 2022) | 2026-10-31 by Claude (research agent): opened the book page the-book-2nd.html and parsed RLbook2020.pdf in memory (page tree, bookmarks, document information, text of the pages listed in componentsSeen, keyword searches across all 548 pages); no file was saved | 4 components listed in the record | open; import allowed | 6 limitations recorded | MBI-06 spine, MBI-09 spine |
| `tolman-1948-cognitive-maps` | Web transcription at Classics in the History of Psychology (original: Psychological Review 55(4), 189-208, 1948; original page breaks marked [p.190] to [p.208]) | 2026-10-31 by Claude (research agent): opened the article page and the site's index, copyright note and 'What is CHP?' pages; checked the DOI metadata in Crossref | 4 components listed in the record | open_restricted_reuse; no import | 6 limitations recorded | MBI-09 supplement |
| `turing-way` | Online handbook, rolling community publication (MyST build; no version number shown; viewed 2026-10-31) | 2026-10-31 by Claude (research agent): opened the landing page, the Guide for Reproducible Research (chapter list), Overview of Reproducible Research, Definitions, Open Research, Open Notebooks, the Guide for Project Design and its Getting Started Checklist | 6 components listed in the record | open; import allowed | 5 limitations recorded | MBI-12 spine |
| `wilson-collins-2019-ten-rules` | Version of Record, eLife 8:e49547, published 26 November 2019 (received 26 June 2019, accepted 9 October 2019; PDF file elife-49547-v2.pdf) | 2026-10-31 by Claude (research agent): opened the eLife article page and its JATS XML and read the metadata, licence, abstract, sections s1, s3, s5-s11, Boxes 1-7 and Appendix 2 in full; opened the GitHub repository AnneCollins/TenSimpleRulesModeling (API metadata, file list, README, LICENSE, three figure scripts and the simulation, likelihood and fitting functions) | 6 components listed in the record | open; import allowed | 11 limitations recorded | MBI-04 supplement, MBI-06 supplement, MBI-11 supplement, MBI-12 supplement |

### Leads awaiting resolution

| Lead | Named by | Note |
|---|---|---|
| Sources on hierarchical and compositional representations | COG-250 | Lead only, for unit 6; to be requested through the library. |
| Sources on analogy and relational reasoning | COG-250 | Lead only, for unit 7; to be requested through the library. |
| A source on missing observations, privacy and application claims in behavioural modelling | COG-260 | Lead only, for unit 8; to be requested through the library before the unit is prepared. |

<!-- coverage:end -->

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

## Sections 13 to 20: reconciliation and status

Reconciliation started from commit `5faa665` on 9 November 2026: a clean working tree, no git
remote, the site deployed on Railway, and the owner account not yet created. "At reconciliation"
records the state then (*works*, *partial*, *missing*, *blocked*); "Now" records the status and
what verifies it. The journeys named here ran on the development server and on a local
production build against an empty database ([QA_REPORT.md](QA_REPORT.md)); none ran on the live
site, which has no account yet.

### 13. The programme experience

| Requirement | At reconciliation | Now |
|---|---|---|
| Discover the programme during onboarding | works: the interests step lists programmes and confirming follows them; no journey exercises it | works: journey spec 03 chooses Mind, Brain and AI on a new account's interests step and finds it followed after confirming (clean-start run) |
| Existing users explore without repeating onboarding, losing preferences or replacing programme choices | partial: `/programmes` works, but re-running orientation step 9 withdraws enrolments made since, and step 11 resumes paused or left programmes | works: after orientation the plan steps change nothing (refused on the server), and the interests step only follows newly chosen programmes, never unfollowing or resuming one (`followNewProgrammes`; programmes test; spec 10) |
| Follow, request a route, confirm a route and enrol stay separate | works (seed test; spec 09) | works (seed and programmes tests; specs 09 and 10: proposing, confirming and declining a route enrol nothing) |
| Overview: description, twelve blocks, eight electives, departments, derived readiness | works | works (spec 09) |
| Overview: prerequisite and bridge routes as a readable grouped sequence with a list equivalent | partial: bridges sit inside each block; the stage grouping is hidden whenever blocks exist | works: *The route, by stage* lists each stage's courses in order with role and readiness, then the bridges into the blocks (spec 10) |
| Overview: a manageable next step | missing | works: *Where to begin* derives one step (`programmeNextStep`; next-step tests; spec 10) |
| Overview: workload preview before enrolment | partial: one weekly figure on the course page | works: the course page breaks the estimate down by kind of work and states the share done independently (`workloadBreakdown`; planning tests; spec 10) |
| Block numbering is not a prerequisite chain | works | works |
| Block pages: question, scope, courses, units, prerequisites and alternatives, activities and evidence, source status, readiness, missing resources, next action | partial: expandable cards on the overview; no address, next action or missing-resource summary | works: `/programmes/[id]/blocks/[blockId]`, with the learner's prerequisites rule by rule and the mapped courses' source leads (spec 10; axe) |
| An empty mapping never yields "ready" | works in the logic; no test with an empty mapping | works (next-step and progress tests with empty mappings) |
| Curriculum readiness kept apart from the learner's progress | partial: a badge and one line | works: separate sections, each saying what it does not mean (spec 10) |
| Shared units: no duplicate obligations; evidence counted once; reattempts distinct | works: units are one work item; following creates no obligation; a new attempt starts after acceptance | works (progress tests; programmes test: following and confirming create no obligation) |
| Director: small starting route, prerequisites explained, prior knowledge recognised, existing studies integrated | partial: fixed rules pick two open blocks and their courses; prerequisites, prior knowledge and the chosen load are not used | works: `proposeRoute` proposes at most two focus blocks and two new courses within the chosen load, keeps the existing focus and courses, and explains each rule as met, self-reported or to prepare, with its alternatives (route tests; spec 10) |
| A mathematics background does not waive biology, psychology, programming or method preparation | works by construction (prerequisites are concept-level) but untested | works (route test; seed test against the real catalogue) |
| Programme changes stay proposals; existing commitments are not displaced silently | partial: confirming replaces the focus blocks without showing the change | works: the proposal shows the focus before and after and each course's action before anything is confirmed (spec 10) |
| Reader, workbench, laboratories, notebook, assignments, seminars and office hours reused | works | works |
| Prediction before results; saved predictions; persistent reveal state | works: predictions are notebook entries that open the laboratory | works (lab-predictions test; specs 09 and 10) |
| Deliberate reattempt or reset of a prediction | missing | works: *Predict again* hides the results until a new prediction is saved, across reloads (prediction and lab-predictions tests; spec 10) |
| AI classmates optional, identified, bounded, without unreleased solutions | works | works; a scripted turn says it is one, and every label names what produced it (spec 06) |
| Quiet mode keeps every academic function | works (spec 06) | works (specs 06 and 10: programme pages, block pages and the studio stay) |

### 14. Teaching, feedback and academic regressions

| Requirement | At reconciliation | Now |
|---|---|---|
| Teaching separates question, observations, assumptions, predictions, competing explanations, available information, what is established and what is not | partial: the COG-260 and COG-250 report headings and the information contracts | works: the assessor and the studio's supervisor apply the modelling standard, and the studio report keeps the ten distinctions as headings (prompts and studio tests) |
| Code execution, metrics, parameter names and AI agreement are not equated with understanding, validity, constructs or certification | partial: lesson text and grading notes only | works: part of the modelling standard in both prompts (prompts tests) |
| Modelling feedback distinguishes implementation, method, evaluation design, interpretation, claims, reproducibility and uncertainty | missing | works in the prompts and the tutor policy (`MODELLING_DIMENSIONS`; prompts tests); whether a live model follows them is unverified until live tutoring runs |
| Defensible alternatives and meaningful negative results accepted | partial: alternatives flagged per rubric; negative results not stated | works in the prompts (prompts tests); live behaviour unverified |
| Revisions, challenges, provisional feedback, original submissions and assessment versions kept | works: immutable versions; a regrade adds a run; challenges recorded | works; NEU-220 exercise 3's rubric is now version 2, and earlier assessment runs keep version 1 |
| Regression: COG-260's corrected biased-responding claim | partial: the model is tested; the lesson text is not | works (regressions test: the false claim is absent and the split-by-arm reading present; the simulation's side in the choice-model tests) |
| Regression: exit exercises ask only for available information | missing | works (regressions test: COG-250 exercise 2's windows, episodes, settings and seed checked against the laboratory's own run) |
| Regression: rubrics read their own study descriptions | missing | works (regressions test: COG-250 exercise 3's invented study fits to training data, its rubric says so, and only a note naming the misreading calls it in-sample) |
| NEU-220: evaluation question documented; split, labels, questions and rubric agree | partial: the contract is right; the rubric and lesson do not say what the split tests | works: the laboratory shows each split's question and contract; the lesson, exercise 3 (both questions word for word, both contracts), rubric version 2, instructor notes and unit instructions agree (regressions test) |
| Held-out trials distinguished from generalisation to stimuli absent in training | partial: only held-out trials are offered | works: a labelled held-out-orientation split (`splitByOrientation`; core tests; spec 05). At the default seed the failure dataset is narrowly ahead of the baseline on held-out trials and behind it at every held-out orientation |

### 15. Data, sources and documentation

| Requirement | At reconciliation | Now |
|---|---|---|
| Domain services and the database are the only runtime state | works | works: the studio uses the same database and services |
| Versions, mappings, alternatives, locators, readiness, evidence, preferences, proposals and enrolments preserved | works (versioned seeding; seed test) | works (seed tests; reseeding after the NEU-220 change created one course version and left 85 unchanged) |
| Candidate vs verified source; verified source vs lesson support; syllabus vs prepared content; availability vs understanding; appointment vs deadline | works: leads vs records, per-unit locators, unit status, evidence states, obligations | works, recorded item by item in the generated tables above |
| Coverage per block, elective, method and requirement (location, course or unit, source and locator, readiness, gap, evidence) | partial: programme-level tables only | works: the generated tables above (`pnpm content:coverage`; the coverage test fails when they drift) |
| Source records keep what was inspected, version, availability, support and conditions | works | works: the sources table above is built from each record |
| Plan, status, academic model and QA documents updated; seeding idempotent | works for M9 | works |

### 16. Required depth and the research studio

| Requirement | At reconciliation | Now |
|---|---|---|
| Twelve meaningful block mappings | works (validator); MBI-02, MBI-10 and MBI-12 proposed | works, recorded block by block above: eight partly prepared, MBI-03 with verified sources only, MBI-02, MBI-10 and MBI-12 proposed. MBI-12's studio is a working tool; its mapped courses are still proposed |
| Eight electives with honest readiness | works: proposed, audit only | works |
| Eight modelling methods explicit | works; 9.6 has no prepared unit | works; 9.6 is planned only |
| Source-resolution workflow | works: leads reach the library request list | works; block pages also list the mapped courses' leads |
| Prepared COG-250 and COG-260 units; complete modelling loop | works: one prepared unit each | works: one prepared unit each; their other seven units are outlines |
| Research studio: question, focused shelf, proposal, methods, provenance, notebook, artifacts, feedback, revision, report, optional oral discussion; five kinds of project; no new participant data, recruiting, contact, publishing or private-data import, while existing datasets about people may be analysed as their licence or terms permit; demonstrations never shown as Leon's work | missing | works: `/studio` (studio tests in core and db; spec 10 at both viewports). In the scripted demo feedback is the structural checks alone; live supervisor feedback is unverified. No demonstration project exists, and the records page leaves out any that is flagged |
| Usable director proposal flow; rolling scheduling without forced examinations | works | works |
| Psych-101 not downloaded | works | works |

### 17. Tests

The two `planning.test.ts` files are `packages/core/src/labs/planning.test.ts` (the COG-250
planning laboratory) and `packages/core/src/planning/planning.test.ts` (study preferences,
obligations and the rolling horizon).

| Requirement | At reconciliation | Now |
|---|---|---|
| Study planning: defaults only when unset; term mode survives; previews include independent work; appointments, deadlines and sequence separate; no default deadline or examination; infeasible schedules explained | partial: explicit `false`, `0` and `null` untested (`null` overrides a default); the preview has no breakdown; infeasibility is tested in `engine.test.ts` | works (planning tests: `null`, `false` and `0` preferences, term mode, the breakdown, nothing compulsory by default; `engine.test.ts` checks the explanation of an infeasible week) |
| Progress: readiness from mapped units; empty mappings; shared units; method states from evidence; readiness is not mastery | partial | works (progress and next-step tests) |
| Laboratories: rules, transitions, reproducibility, prediction and reveal persistence, splits, displayed outputs matching exercises, ambiguous results | partial: persistence and output-exercise agreement untested | works (lab-predictions test; regressions tests; tuning split tests) |
| Database and seed: preferences persist, originals survive, verified content not reset, no duplicates, following and confirming do not enrol, enrolment validated | partial | works (study, programmes and seed tests) |
| Browser: new and existing users, discovery, director, separate enrolment, persistence after reload, the two units, the studio, desktop and mobile, quiet mode, missing-resource and provider-failure states | partial: no new-user programme journey, studio, provider-failure or missing-resource journey | works: spec 10 at both viewports; spec 03's new-account branch runs once per run, at the first viewport, on a database without the account |
| Screenshots inspected; clean starts, restarts, failures, reruns and skips recorded; development, local production and deployed runs kept apart | not yet done for this milestone | done: [QA_REPORT.md](QA_REPORT.md), Milestone 10 |

### 18. The live product

| Requirement | At reconciliation | Now |
|---|---|---|
| The existing Railway project is the target; project, service, environment and commit verified; versioned migrations; the worker updated when shared content or migrations change | works for the first release | works: project `corniversity`, environment `production`, its services and the commit verified before release; the worker released first from `1b93eae` (migrations 0004 to 0006 applied; one course version seeded, 85 unchanged), then the web service; the web service released again from `6a01e17` for the studio's sign-in return ([QA_REPORT.md](QA_REPORT.md), Milestone 10); the audit's fixes released on 10 November 2026 from `40c2624`, the worker first (migration 0007), then the web service (QA_REPORT, "After the release") |
| The owner creates the account | **blocked**: not created on 9 November | **blocked**: still not created |
| Registration closed on the server; the bootstrap code cannot be reused; restarts do not reopen setup | works (sign-up hook; state in the database); untested as such | works (owner test: setup, a second owner refused, a restart); on the live site unverifiable until the owner exists |
| Concurrent setup submissions cannot create two owners | partial: rests on the unique email | works: a one-owner unique index (owner test with concurrent inserts) |
| Bootstrap credential retired and removed from use where safe | partial: unusable once an owner exists, but still a required variable | works in code (optional once the owner exists); removing the variable from both services is the owner's step ([USER_ACTIONS.md](USER_ACTIONS.md)) |
| Secrets not printed in logs, reports, screenshots or artifacts | partial: the deploy script prints the code | works: the deploy script prints no secret; the health route and the worker's log give asset counts and versions only |
| Scripted responses labelled "Scripted demo"; "AI" alone never implies a live model | missing: labels read "AI tutor" whatever produced the text | works: every label names the model, "model blocked" or "scripted demo", and the scripted texts say so (specs 06 and 10) |
| Canned responses not presented as analysis of the learner's work | works in the fixture texts | works |
| Provider integration verified rather than assumed | partial: compiles; no request has ever been made | partial: a contract test drives the real SDK against a local server speaking the documented wire format (13 tests); no request has reached Anthropic |
| Server-side secrets, no credential in browser payloads, masked display | works (encrypted key, last characters only) | works |
| Configurable, currently supported model identifiers | missing: environment default only | works: an allow-list in `packages/ai/src/models.ts`, chosen in Settings |
| Explicit owner approval for paid use | missing | works: the approval records the model, the fallback choice and the limits; changing any of them needs approval again (state and provider-config tests) |
| Finite spending limits and per-run limits | partial: the hard stop can be switched off; the per-run check uses `Math.min(estimate, cap)` and under-counts | works: always hard, under fixed ceilings, checked against the worst case (budget tests) |
| Actual usage recorded | works (provider runs) | works: per attempt, including a server-side fallback |
| Clear failure and quota states | partial: missing model, permission and billing errors become a generic retryable failure | works: authentication, permission, billing, unavailable model, rate limit and overload are distinct, as are the blocked reasons (contract and state tests; spec 10) |
| No silent fallback to canned feedback | partial: a missing or unreadable key falls back to fixtures | works: a blocked run is refused and recorded, and the learner's message is kept (spec 10) |
| Current official provider documentation consulted | done: Claude API reference (cached 6 October 2026) and the installed SDK 1.3.0 types | done |
| Small live test with the owner's key and approved budget | **blocked**: no key, no approval | **waiting for the owner**: no key or approval yet; the test is item 4 of [USER_ACTIONS.md](USER_ACTIONS.md), run by the owner because the build agent cannot sign in as the owner; the live path is checked only against a local wire-format server so far |
| Non-sensitive diagnostic that prompt and script assets load in the deployed service | missing | works: the health route and the worker's start-up log report "7 of 7" scripted responses and six prompt versions, without contents or paths (production build, local); on the live site the health route reports the same, and the worker's start-up log says "7 of 7 scripted responses load" with the six prompt versions |
| Authenticated production checks | **blocked**: no owner account | **waiting for the owner**: no owner account yet; the owner runs the checklist (sign-in, sign-out, persistence, one learning journey), and the closed sign-up and the removed bootstrap code are then checked from outside |
| Documented, tested recovery without a public bypass | partial: `pnpm owner:reset-password` fails with `ERR_MODULE_NOT_FOUND`, leaves sessions valid, is untested and cannot reach production | works: the command runs in the worker image (`railway ssh --service worker`), reads the password without showing it, also while the line is edited, signs the owner out everywhere at once (sessions are not cached in cookies) and is audited (owner test; prompt test; the command run end to end against a throw-away database); not run on the live site |
| Hosting, model use and other services costed separately with assumptions | partial | done: [HANDOFF.md](HANDOFF.md) |

### 19 and 20. Handoff and in-place execution

Recorded in [HANDOFF.md](HANDOFF.md), [STATUS.md](STATUS.md) and [QA_REPORT.md](QA_REPORT.md).
