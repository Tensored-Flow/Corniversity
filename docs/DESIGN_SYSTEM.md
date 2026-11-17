# Design system

A contemporary scholarly college: calm, warm, precise, inhabited. Not a KPI dashboard, not a
chat clone. Light mode is primary; a designed dark reading mode exists.

## Tokens (defined once in `apps/web/src/app/globals.css`)

Surfaces: `--paper` (warm off-white), `--paper-2` (card), `--stone` (borders/dividers),
`--ink` (text), `--ink-2` (secondary text), `--brass` (accent, links, native checkboxes and radios),
`--focus` (the brass focus ring, at least 3:1 against every surface it is drawn over), `--moss` (success /
demonstrated), `--rust` (warnings / revisit), `--slate` (information), `--scrim` (behind a modal
dialog; it dims in both themes, where `--ink` would lighten the dark one). Dark reading mode remaps
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
`/library/sync`, jobs `/library/jobs`; research library pages below · 11 Reading room
`/library/read/[id]` (the PDF reader) · 12 Laboratory
`/sessions/[id]` (activity with a `labId`; the lab panel sits above the report) · 13 Timetable
`/timetable` · 14 Common room `/common-room`, discussion `/common-room/[id]` · 15 Notebook
`/notebook`, entry `/notebook/[id]` · 16 Records `/records` · 17 Settings `/settings` · 18 Programmes
`/programmes`, programme `/programmes/[id]` · 19 Session close `/sessions/[id]/close` · 20 Concept
bridge `/bridges/[conceptId]` (opened through `/bridges/open`) · timetable slots open through
`/study/slot/[id]`.

## Research library (Milestone 20)

Every page's behaviour is in [RESEARCH_LIBRARY.md](RESEARCH_LIBRARY.md), §2 and §7; this section
holds the visual and interaction rules. The pages reuse `LibraryHeader`, `ui.tsx`, the colour roles
and the notices allowlist; nothing new is added to the main navigation.

**Header.** `LibraryHeader` keeps h1 "Library" and one row of tabs: *My library · Discover · Find
papers · Shelves · Trails · Sources · Books to obtain*. On a phone the tabs wrap instead of
scrolling sideways, so every section and the current one stay in view. The desktop-sync badge shows
on the home and material pages only.

**Screens.** Library home `/library` (find box with *Add a paper*, *Discover* and *Library notes*;
*Continue reading*; *Saved papers* with views *All saved · Read later · Favourites · Read ·
Recently opened*; *Shelves and trails* with a create form; the Files list) · Find papers
`/library/find` · preview `/library/works/[scheme]/[...value]` and paper page
`/library/papers/[workId]`, one `PaperView` for both · a paper without an identifier
`/library/papers/new` · Discover `/library/discover` and subject rooms `/library/subjects/[slug]` ·
shelves and trails `/library/shelves`, `/library/trails` and one collection at
`/library/shelves/[id]` or `/library/trails/[id]` · library notes `/notebook?library=1`.
Rows show title, first authors, year and venue. Provider facts always say who reported them
(*cited by N according to OpenAlex*, *Free to read according to OpenAlex*, a licence *as reported by
arXiv OAI-PMH*); recorded test data carries a *Fixture data* label. Owner text (notes, reasons,
descriptions) renders through the Markdown and KaTeX sanitiser; quotes render as escaped text.

**Forms and notices.** Each form returns to its own section (`#…`, named again as `at=`) and shows
its notice inside that section, in view. *Remove* asks first on its row when a note or reason is
written there; *Delete this paper and its notes* lists what goes before its confirmation.

**Every state says what happened and offers a next step** (the brief's important states, §18.2, in
RESEARCH_LIBRARY.md): an empty view says what fills it; a provider failure gives the provider's
sentence, never "no results"; a list the worker has not fetched yet says *Not fetched yet* and
refreshes itself; a rejected file says why and what to do next.

**The reader** (`/library/read/[id]`, route group `(reader)`): a full-height frame with no app
chrome, its own `main` and skip link. Desktop bar: *Back to paper* · title · version · page n of N
(with the printed label) · previous and next · go to page · zoom · *Contents* · *Find* · *Notes* ·
*Paper* · *Ask* · *Hide panel* · *Full screen* (and *Text view* where text is extracted). No
single-letter shortcuts; PageUp, PageDown, Home and End work while the pages have focus, and Ctrl+F
(Cmd+F) opens *Find*. On phones
and short landscape screens (at most 640 px wide or 500 px high) the bar is compact: *Back* · title
· *Panels*, then previous and next · page · zoom, in two rows at 390 px and one at 844 × 390.

**Reader panels.** One panel at a time: an aside on the desktop; on phones a native `<dialog>`
opened by *Panels*, with the section switches, a visible *Close*, *Text view* and *Full screen*
(Escape closes it). *Contents* (the outline; an entry moves focus to
its page); *Find* (in the document); *Notes* (*Bookmark page*, *Page note*, *Mark area*; the
Document's annotations in reading order with *Go to*, *Edit* and *Delete*, and the rest under *Needs
repair*); *Paper* (title, authors, year, venue and version as reported, with who reported them and
when; *Paper page*); *Ask* (the reading companion, closed by default; when external AI is not
allowed it shows the permission form with what asking would send and the file's licence; every
answer is labelled with its model or as the scripted demo). A selection shows a bar at the foot of
the pages: *Highlight* (one of five colour roles: brass, moss, rust, slate, neutral) · *Note* ·
*Ask* · *Clear*. A linked arXiv paper carries a persistent attribution line and the disclosure that
the browser downloads the PDF from arxiv.org. When arxiv.org cannot be reached the reader says so,
with *Open on arXiv* and *Try again*. Without JavaScript the Page view says so and offers the Text
view, the original file and the way back.

**Jobs, in words.** `/library/jobs` describes each job in one plain sentence built from its kind and
the parts of its payload that name the work (`describeJob` in `library/jobs/describe.ts`), with a
link to its paper or file while that exists, else *That paper is no longer in your library.* and no
*Retry*. Idempotency keys are never shown; the Progress column shows a stage only while a job is
queued or running.

**The 404 page.** Every 404 has exactly one `main`. The root `not-found.tsx` (an address no route
matches) renders its own; `(app)/not-found.tsx` and `(reader)/not-found.tsx` render inside their
layout's `main`. The reader's says *No document here.*: the address names no file or paper in the
library, with links to the Library and the library notes.

**The offline error page.** `app/error.tsx` tells a lost connection apart from a failure
(`isConnectionFailure` in `app/_error/connection.ts`). Offline it reads *No connection* · *The
server could not be reached*, says that what was last sent may not have arrived, and asks for a
reload once back online before sending anything again, never claiming that nothing was lost.
Its button is *Reload*. Otherwise it reads *Something went wrong* · *This page could not be shown*,
with *Try again*. Both link back to the campus.

**Accessibility.** axe (WCAG 2.2 A/AA, serious and critical) in light and dark on every Library
page and the reader with each panel; a visible focus ring at every keyboard stop in the reader;
touch targets of at least 24 × 24 CSS pixels on phones in the reader, shelves, trails, notebook and
records; no transitions under reduced motion (journey 08). Selecting text in the pages needs a
pointer or caret browsing; the page note is the keyboard alternative to a highlight, and *Mark area*
needs a pointer.

## Study workspace (teaching-experience brief, §3)

One workspace per learning session at `/sessions/[id]`; every route into study (timetable slot,
*Continue* on Today, a unit's activity list, a bridge's return link) lands here and resumes it.

**Layout.** Desktop: a compact session header across the top; the main column holds the material
(lesson, video reference, external reading, exercise, laboratory); one context panel on the right
with tabs (Tutor, Notes, Prerequisites, Sources) instead of stacked columns. Phone: header, then
the material; the context panel becomes a full-width section below with the same tabs. Nothing
is permanently cramped into four columns.

**Header.** Course and unit, the unit objective in one line, the exact source of the current
activity (locator label, or "external reference: …"), the activity kind, the last durable point
("Saved on the server 14:02" / "Saved on this device, not yet on the server" / "Not saved: …"),
and *Pause* / *Resume*. Pausing records the position and returns to Today; nothing is graded.

**Material.** Reading: the lesson with its locators; selecting text offers *Ask about this* and
*Note this*, which attach the selection, the unit and source identity and the learner's recent
work, shown before sending ("What the tutor will see"); scope defaults to the selection, with an
explicit *Use the whole unit* choice. Video: an exact link to the authorised lecture with manual
timestamp notes (mm:ss), because no external player is controlled. External-only reading: the
exact reference and a manual progress field ("read to §2.3 / p. 34"), never an embedded book.

**Help controls** on every exercise, the same four everywhere: *Small hint*, *Discuss my approach*,
*Check this step* (needs selected lines of the attempt) and *Full explanation* (practice mode
only; in self-test it is refused before any model call). Each request is recorded as assistance
with its mode; none is a penalty and none is evidence of understanding.

**Attempt editor.** Typed Markdown/LaTeX or paper pages (photos or PDF) with a transcription the
learner confirms. Save states: *Saving…* → *Saved on the server* (revision n) | *Saved on this
device* (offline; retried) | *Conflict* (a newer revision exists: both versions are shown and the
learner chooses; nothing is overwritten silently).

**Session close.** *Finish for now* shows: what was saved (attempt revision, notes, questions),
what remains unresolved (open questions, unconfirmed transcription, pending assessment), one
possible next step; the summary is factual, editable and never marks a concept demonstrated.

**States every panel designs:** loading; no key (scripted demo, labelled); no source; rights
blocked (reference-only); extraction failed; upload interrupted; permission denied; conflicting
edit; offline device; provider error; limit reached (the reason, never canned text).

**Bridges.** *Prerequisites* lists the unit's prerequisite concepts with an honest state each:
supported by specific work, self-reported (unverified), not yet shown, and whether a bridge is
prepared or unprepared. *Explain this prerequisite* opens `/bridges/[conceptId]` with a breadcrumb
back to the exact session, exercise and position; bridges nest at most two deep, and a cycle is
reported instead of followed.
