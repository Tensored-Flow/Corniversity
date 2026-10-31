# Design system

A contemporary scholarly college: calm, warm, precise, inhabited. Not a KPI dashboard, not a
chat clone. Light mode is primary; a designed dark reading mode exists.

## Tokens (defined once in `apps/web/src/app/globals.css`)

Surfaces: `--paper` (warm off-white), `--paper-2` (card), `--stone` (borders/dividers),
`--ink` (text), `--ink-2` (secondary text), `--brass` (accent, links, focus), `--moss` (success /
demonstrated), `--rust` (warnings / revisit), `--slate` (information). Dark reading mode remaps
the same roles. Contrast ≥ 4.5:1 for text roles (checked in QA).

Type: `Fraunces` (display serif, headings, wordmark), `Source Serif 4` (reading body),
`Inter` (UI), `JetBrains Mono` (code), KaTeX fonts (mathematics). All OFL, self-hosted via
`@fontsource-variable`. Scale: 14/16/18/22/28/36/48 with 1.5 body leading; adjustable base size.

Space: 4-pt grid; page gutter 16 px on phones, 32 px on desktop; reading measure 68ch.
Radius: 6 px (controls), 10 px (panels). Shadows: none or a 1-px stone hairline. Motion: 150 ms
fades only, disabled under `prefers-reduced-motion`; none during scored work.

## Components

Wordmark/crest (original SVG), `PageFrame`, `SideNav` (Campus, My Studies, Timetable, Library,
Notebook, Common Room, Catalogue, Programmes; Director as a quiet affordance), `CommandSearch`, `Card`, `Button`
(primary brass, secondary stone, quiet text), `Field` with accessible errors, `Badge` (readiness,
AI label, evidence state), `Math` / `Markdown` (KaTeX, sanitised), `SourcePanel`, `HintLadder`,
`ProofEditor`, `FeedbackCard` (line-localised), `Timetable` (week/agenda), `ReadingRoom`,
`CampusMap` (SVG with list equivalent), `Toast`, `EmptyState`, `DeniedState`, `OfflineState`,
`PredictionGate` (laboratory results hidden until a prediction is saved), block readiness badges
(prepared, partly prepared, sources only, proposed) and the programme map on My Studies.

## Interaction rules

Every primary button performs its real job. Loading, empty, denied, offline, missing-key,
failed-import and assessment-disagreement states are designed. Keyboard operable; visible focus
ring (brass, 2 px). Side panel on desktop becomes a full-width panel on mobile. No four-column
squeeze. Lists may scroll in their own region; instructions never require page scroll on a
390×844 viewport.

## Screens (brief §5) → routes

1 Arrival `/` · 2 Onboarding `/onboarding/[step]` · 3 Welcome `/welcome` · 4 Campus `/campus`
(map `/campus/map`) · 5 Department `/departments/[id]` · 6 Catalogue `/catalogue` · 7 Course foyer
`/courses/[id]` · 8 Lecture room `/sessions/[id]` (reading activity) · 9 Tutorial workbench
`/sessions/[id]` (activity with exercises) · 10 Library `/library`, sources `/library/sources`,
requests `/library/requests`, upload `/library/upload`, item `/library/items/[id]`, desktop sync
`/library/sync`, jobs `/library/jobs` · 11 Reading room `/library/read/[id]` · 12 Laboratory
`/sessions/[id]` (activity with a `labId`; the lab panel sits above the report) · 13 Timetable
`/timetable` · 14 Common room `/common-room`, discussion `/common-room/[id]` · 15 Notebook
`/notebook`, entry `/notebook/[id]` · 16 Records `/records` · 17 Settings `/settings` · 18 Programmes
`/programmes`, programme `/programmes/[id]`.
