# Source starting points for Meridian

Prepared on 30 October 2026. These sources were inspected through official/public webpages or current GitHub file reads while preparing the brief. Verification here means the stated entry point and described material were observed; it does **not** mean every video, assignment, linked PDF, book chapter, package API, or licence condition has been audited. Codex must verify exact resources before publishing a teaching unit.

No restricted library book was accessed. No conclusion is made that Imperial has a particular title or that a library subscription authorizes cloud storage, embedding, or AI processing.

## Frameworks and application references

| ID | Source | What was established | Implementation consequence |
|---|---|---|---|
| alter | [ALTER repository](https://github.com/dmserrano/alter-learning) | Its current README describes a Claude Code learning plugin with adviser, librarian, tutor, editor, and cross-domain discussion roles, plus coordination/review helpers. | Adapt the role structure; this is not already a web backend. Inspect the actual licence and upstream commit. |
| alter-conventions | [ALTER conventions](https://github.com/dmserrano/alter-learning/blob/main/skills/alter/reference/conventions.md) | Current conventions specify topic/module Markdown records, teaching tracks, and opt-in review scheduling. | Preserve useful export conventions, but design real application persistence and university-wide timetabling separately. |
| deeptutor | [DeepTutor](https://github.com/HKUDS/DeepTutor) | Official repository presents a substantial personalized tutoring application. | Optional architectural/UX reference. Re-check current functionality and licences before reuse. |
| openmaic | [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) | Official repository presents an interactive multi-agent classroom. | Optional interaction reference; not a mandatory second runtime or a substitute for academic validation. |

The current ALTER README and conventions were read using the GitHub connector, not solely a potentially stale search-engine summary. Inspect current paths under `skills/`; do not assume an older repository layout.

## Academic source anchors

| ID | Source | Verified scope / caution |
|---|---|---|
| mit-fa-2021 | [MIT 18.102 Introduction to Functional Analysis, Spring 2021](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/) | Public course landing page lists notes, videos, assignments/exams and core functional-analysis topics. |
| mit-fa-syllabus | [Functional Analysis syllabus](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/pages/syllabus/) | Specifies prerequisites, use of course notes, weekly homework and assessments. Do not assume an assigned commercial textbook. |
| mit-fa-calendar | [Functional Analysis calendar](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/pages/calendar/) | Gives an explicit lecture-topic sequence and assignment/exam milestones. Adapt pacing rather than transplant institutional dates. |
| mit-algebra-2010 | [MIT 18.701 Algebra I, Fall 2010](https://ocw.mit.edu/courses/18-701-algebra-i-fall-2010/) | Public course covering groups and related algebraic structures. Confirm exact materials available for each planned unit. |
| mit-algebra-notes-2021 | [MIT Algebra I Student Notes, Fall 2021](https://ocw.mit.edu/courses/res-18-011-algebra-i-student-notes-fall-2021/) | Notes are presented as supplements to the earlier OCW course. Keep their provenance distinct. |
| lee-riemannian | [John M. Lee: Introduction to Riemannian Manifolds](https://sites.math.washington.edu/~lee/Books/RM/) | Author's page identifies the book/edition and its scope. It is not a claim that the full book is freely available for ingestion. |
| mit-gr-2020 | [MIT 8.962 General Relativity, Spring 2020](https://ocw.mit.edu/courses/8-962-general-relativity-spring-2020/) | Graduate-level public course with readings, lecture summaries/videos and assignments. Respect its level. |
| mit-chem-2014 | [MIT 5.111SC Principles of Chemical Science, Fall 2014](https://ocw.mit.edu/courses/5-111sc-principles-of-chemical-science-fall-2014/) | Structured introductory chemistry course covering atomic/molecular structure, thermodynamics/equilibrium and kinetics. |
| openstax-chemistry | [OpenStax Chemistry 2e preface](https://openstax.org/books/chemistry-2e/pages/preface) | Official open-textbook entry point with web/PDF availability. Inspect actual licence and asset exceptions before redistributing. |
| neuromatch-compneuro | [Neuromatch Computational Neuroscience](https://compneuro.neuromatch.io/) | Primary public teaching site. [Repository](https://github.com/NeuromatchAcademy/course-content) identifies the ebook as the main access route. |
| neuromatch-compneuro-schedule | [Computational Neuroscience schedule](https://compneuro.neuromatch.io/tutorials/Schedule/daily_schedules.html) | Explicit intensive sequence and tutorial/project schedule. It is not an evening-study workload estimate. |
| neuromatch-deep-learning | [Neuromatch Deep Learning schedule](https://deeplearning.neuromatch.io/tutorials/Schedule/daily_schedules.html) | Primary course site and its organized teaching/project schedule. Inspect individual units before selecting them. |
| neuromatch-neuroai | [Neuromatch NeuroAI schedule](https://neuroai.neuromatch.io/daily-schedules/) | Primary advanced interdisciplinary course schedule. Verify entry requirements and current resource paths. |
| stanford-cs336 | [Stanford CS336](https://cs336.stanford.edu/) | The inspected page is Spring 2026, with substantial programming/deep-learning/systems prerequisites and assignments. Preserve the external course's policy information. |
| mit-cognitive-science | [MIT CBMM computational cognitive science entry](https://cbmm.mit.edu/education/courses/computational-cognitive-science) | An authoritative course entry point and description. This alone does not establish complete public teaching material for a given year. |

For smooth manifolds, measure/martingales, mechanics, special relativity, and other catalogue topics, Codex still needs to inspect suitable primary courses or author/publisher resources. Candidate books in the brief are not already checked chapter maps.

## Execution and infrastructure

| ID | Source | Use |
|---|---|---|
| codex-long-tasks | [OpenAI: Run long horizon tasks with Codex](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex) | Official discussion of persistent specifications, milestone plans, verification, and status records. This supports the build workflow; it is not a guarantee that one unattended run will finish every feature. |
| codex-exec-plans | [OpenAI: Using PLANS.md for multi-hour problem solving](https://developers.openai.com/cookbook/articles/codex_exec_plans) | Official detailed planning pattern. Adapt current instructions and do not copy outdated model/version recommendations uncritically. |
| codex-workflow | [OpenAI: Iterating Development Workflows with Codex](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex) | Distinguishes recognized AGENTS.md guidance from optional project-specific planning-file conventions. |
| railway-compose | [Railway: Deploy a Docker Compose app](https://docs.railway.com/guides/docker-compose) | Describes mapping Compose services to Railway services, not executing Compose unchanged. |
| railway-postgres | [Railway PostgreSQL documentation](https://docs.railway.com/databases/postgresql) | Database deployment/configuration entry point. Inspect the actual chosen image and extension availability. |
| railway-rag | [Railway pgvector/RAG guide](https://docs.railway.com/guides/rag-pipeline-pgvector) | Relevant architecture guide. Do not assume every default PostgreSQL image contains pgvector. Verify extension/persistence details in the actual deployment. |

## Library rights and permissions

[Imperial copyright guidance for students](https://www.imperial.ac.uk/admin-services/library/learning-support/copyright-guidance/copyright-for-students/) explicitly cautions against uploading its teaching materials to websites and online AI/LLM tools. This concerns teaching-material rights and should not be carelessly generalized into a claim that every possible ebook has identical terms.

[Imperial Library's generative-AI guidance](https://www.imperial.ac.uk/admin-services/library/learning-support/generative-ai-guidance/) is another institutional starting point. Check the specific source licence, access agreement and permitted use. Where uncertain, retain a bibliographic reference and use an authorized alternative rather than sending content to an external model.

## Source-review discipline during implementation

Record retrieval date, actual resource version/edition, access/licence status, verified lesson locators, and unresolved limitations. Keep code licences separate from educational-content permissions. No dead-link substitution, fabricated chapter/page references, or copied third-party solution sets. Source verification does not certify the correctness of every AI explanation that later cites that source.
