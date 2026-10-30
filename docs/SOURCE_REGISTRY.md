# Source registry

Machine-readable records live in `content/sources/*.json` (title, authors/institution,
edition/year, canonical URL, licence, access status, components seen, verification date, verified
locators, limitations). This file summarises status. "Verified" means an agent opened the page
on the stated date and recorded what it saw; it never means every sub-resource was audited.

## Framework references

| ID | Source | Inspected | Status |
|---|---|---|---|
| alter | github.com/dmserrano/alter-learning @ `467daa5c` (2026-09-01) | 2026-10-30 | MIT licence. Claude Code plugin: skills advisor, librarian, tutor, editor, roommate, flashcards; conventions in `skills/alter/reference/conventions.md`. Role structure adapted; no code copied. |

## Academic anchors (from the owner's VERIFIED_SOURCES.md, re-verification pending per course)

| ID | Source | Licence (to confirm on page) | Planned use |
|---|---|---|---|
| mit-fa-2021 | MIT OCW 18.102 Functional Analysis, Spring 2021 | CC BY-NC-SA 4.0 (OCW standard) | Spine for MAT-230 |
| mit-algebra-2010 / mit-algebra-notes-2021 | MIT OCW 18.701 Algebra I (Fall 2010); RES.18-011 student notes | CC BY-NC-SA 4.0 | Spine/supplement for MAT-270 |
| lee-riemannian | J. M. Lee, Introduction to Riemannian Manifolds, 2nd ed. (author page) | commercial book; reference-only | MAT-262 reference + acquisition request |
| mit-gr-2020 | MIT OCW 8.962 General Relativity, Spring 2020 | CC BY-NC-SA 4.0 | Spine for PHY-240 |
| mit-chem-2014 | MIT OCW 5.111SC Principles of Chemical Science, Fall 2014 | CC BY-NC-SA 4.0 | Spine for CHE-101 |
| openstax-chemistry | OpenStax Chemistry 2e | CC BY 4.0 (check asset exceptions) | Supplement for CHE-101 |
| neuromatch-compneuro | Neuromatch Computational Neuroscience | CC BY 4.0 (check) | Spine for NEU-220 |
| neuromatch-deep-learning | Neuromatch Deep Learning | CC BY 4.0 (check) | Spine for CSA-210 |
| neuromatch-neuroai | Neuromatch NeuroAI | CC BY 4.0 (check) | NEU-230 (later) |
| stanford-cs336 | Stanford CS336 (Spring 2026) | course site; policies preserved | CSA-250 (later) |
| mit-cognitive-science | MIT CBMM computational cognitive science entry | entry point only | COG-201 candidate; needs real material |

Candidates to inspect for the remaining launch courses: Tao, *An Introduction to Measure Theory*
(author-hosted draft) and MIT OCW 18.125 for MAT-210; Judson, *Abstract Algebra: Theory and
Applications* (GFDL) for MAT-270; MIT OCW 18.965 / author-hosted manifold notes for MAT-261;
Taylor & Wheeler, *Spacetime Physics* (authors' free PDF) and D. Tong's notes for PHY-210;
D. Tong's *Classical Dynamics* and MIT OCW 8.09 for PHY-201; probmods.org for COG-201.

## Rights notes

Imperial's student copyright guidance restricts uploading its teaching materials to websites and
AI tools; the app never asks for Imperial credentials and labels Imperial material as not to be
imported. Library ebooks default to reference-only. Code licences are recorded separately from
content permissions in `content/sources/*.json`.
