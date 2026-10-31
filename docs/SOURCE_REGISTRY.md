# Source registry

Machine-readable records live in `content/sources/*.json` (title, authors/institution,
edition/year, canonical URL, licence, access status, components seen, verification date, verified
locators, limitations, rights notes). This file is generated from them and summarises status.
"Verified" means an agent opened the page on the stated date and recorded what it saw; it never
means every sub-resource was audited. The `limitations` array of each record lists exactly what
was not opened.

## Framework references

| ID | Source | Inspected | Status |
|---|---|---|---|
| alter | github.com/dmserrano/alter-learning @ `467daa5c` (2026-09-01) | 2026-10-30 | MIT licence. Claude Code plugin: skills advisor, librarian, tutor, editor, roommate, flashcards; conventions in `skills/alter/reference/conventions.md`. Role structure adapted; no code copied. |

## Academic sources (27 records)

"Import" means the worker may fetch the files named by verified locators from the listed hosts
and the items are permitted for tutors under the recorded licence; everything else is
reference-only until the owner grants permissions per item in the Library.

| ID | Source | Version used | Licence as recorded | Access | Import | Verified | Locators | Used by |
|---|---|---|---|---|---|---|---|---|
| `carroll-gr-notes` | Lecture Notes on General Relativity | arXiv gr-qc/9712019 v1 (3 December 1997); author's chapter PDFs on preposterousuniverse.com | Author copyright; arXiv assumed non-exclusive distribution licence … | readable online; reference-only | no | 2026-10-30 | 10 | PHY-240 (suppl.) |
| `gudmundsson-riemannian` | An Introduction to Riemannian Geometry (Lecture Notes in Mathematics) | Version 1.438 (6 May 2026), author-hosted PDF | Not stated (author-hosted; copyright presumably the author's) | readable online; reference-only | no | 2026-10-30 | 43 | MAT-262 (primary) |
| `hitchin-manifolds-2014` | Differentiable Manifolds (Course C3.3b 2014) — lecture notes | Course C3.3b 2014 (manifolds2014.pdf) | Not stated (author-hosted; copyright presumably the author's) | readable online; reference-only | no | 2026-10-30 | 23 | MAT-261 (suppl.) |
| `judson-aata` | Abstract Algebra: Theory and Applications | HTML edition at judsonbooks.org (title block dated August 4, 2026; the site's book page lists the HTML edition as updated August 1, 2025) | GNU Free Documentation License, Version 1.2 or any later version; n… | open | yes: judsonbooks.org | 2026-10-30 | 65 | MAT-270 (primary) |
| `lee-riemannian` | Introduction to Riemannian Manifolds (Second Edition) | 2nd edition (2018), Springer GTM 176 | All rights reserved (Springer International Publishing AG 2018); co… | commercial; reference-only | no | 2026-10-30 | 19 | MAT-262 (suppl.) |
| `mit-algebra-2010` | 18.701 Algebra I | Fall 2010 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 4 | MAT-270 (suppl.) |
| `mit-algebra-notes-2021` | RES.18-011 Algebra I Student Notes | Fall 2021 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 15 | MAT-270 (suppl.) |
| `mit-chem-2014` | 5.111SC Principles of Chemical Science | Fall 2014 (OCW Scholar publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 83 | CHE-101 (primary) |
| `mit-cm3-2014` | 8.09 Classical Mechanics III | Fall 2014 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 28 | PHY-201 (primary) |
| `mit-cocosci-2004` | 9.66J Computational Cognitive Science (Fall 2004) | Fall 2004 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 102 | COG-201 (primary) |
| `mit-cognitive-science` | Computational Cognitive Science (9.66J / 9.660 / 6.804J) — CBMM course entry page | CBMM course page as published (semester shown: Fall 2021; opened 2026-10-30) | Not stated; CBMM copyright notice and Terms of Use | readable online; reference-only | no | 2026-10-30 | 1 | COG-201 (suppl.) |
| `mit-fa-2021` | 18.102 Introduction to Functional Analysis | Spring 2021 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 62 | MAT-230 (primary) |
| `mit-gm-2004` | 18.965 Geometry of Manifolds | Fall 2004 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 60 | MAT-261 (primary) |
| `mit-gr-2020` | 8.962 General Relativity | Spring 2020 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 24 | PHY-240 (primary) |
| `mit-measure-2003` | 18.125 Measure and Integration | Fall 2003 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 54 | MAT-210 (primary) |
| `mit-sr-2021` | 8.20 Introduction to Special Relativity | January IAP 2021 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 7 | PHY-210 (suppl.) |
| `neuromatch-compneuro` | Neuromatch Academy: Computational Neuroscience (course book) | Course book as published online (repository syllabus dated July 7–25, 2025; book marked 'under continuous development'; viewed 2026-10-30) | CC BY 4.0 (content); code separately BSD-3-Clause | open | yes: compneuro.neuromatch.io | 2026-10-30 | 36 | NEU-220 (primary) |
| `neuromatch-deep-learning` | Neuromatch Academy: Deep Learning (course ebook) | Online ebook, rolling publication (opened 2026-10-30) | CC BY 4.0 (content); BSD 3-Clause (software) | open | yes: deeplearning.neuromatch.io | 2026-10-30 | 39 | CSA-210 (primary) |
| `openstax-chemistry` | Chemistry 2e | 2nd edition, web view (publication date 14 Feb 2019 shown on the preface; viewed 2026-10-30) | CC BY-NC-SA 4.0 (as stated on the preface page, 2026-10-30), with O… | readable online; reference-only | no | 2026-10-30 | 68 | CHE-101 (suppl.) |
| `probmods-v2` | Probabilistic Models of Cognition (2nd edition) | 2nd edition, web (cited as 2016; server Last-Modified 2023-06-05; opened 2026-10-30) | Not stated (site: 'This book is an open source project'); treated a… | readable online; reference-only | no | 2026-10-30 | 26 | COG-201 (primary) |
| `sternberg-semi-riemannian` | Semi-Riemann Geometry and General Relativity | 24 September 2003 (author-hosted PDF) | CC BY-NC-SA 2.0 (stated on the author's books page) | open | yes: people.math.harvard.edu | 2026-10-30 | 19 | MAT-262 (primary) |
| `tao-measure-theory` | An Introduction to Measure Theory | 2011 (GSM 126) with author-hosted online draft (PDF uploaded December 2012) | No licence stated on the author's pages; copyright in the printed b… | readable online; reference-only | no | 2026-10-30 | 2 | MAT-210 (suppl.) |
| `taylor-wheeler-spacetime-physics` | Spacetime Physics: Introduction to Special Relativity (Second Edition) | Second edition (W. H. Freeman, 1992), authors' CC BY 4.0 scans on eftaylor.com | CC BY 4.0 | open | yes: www.eftaylor.com | 2026-10-30 | 46 | PHY-210 (primary) |
| `tong-classical-dynamics` | Classical Dynamics (lecture notes) | Web edition on davidtong.org (undated; HTML version generated 2022-03-24) | No licence stated; author copyright (free to read on the author's p… | readable online; reference-only | no | 2026-10-30 | 17 | PHY-201 (suppl.) |
| `tong-dynamics-relativity` | Dynamics and Relativity (lecture notes) | Web edition on davidtong.org (undated) | No licence stated; author copyright (free to read on the author's p… | readable online; reference-only | no | 2026-10-30 | 13 | PHY-201 (suppl.), PHY-210 (suppl.) |
| `tong-general-relativity` | General Relativity (lecture notes) | Web edition on davidtong.org (undated; HTML version generated 2021-10-15) | No licence stated; author copyright (free to read on the author's p… | readable online; reference-only | no | 2026-10-30 | 16 | PHY-240 (suppl.) |
| `wendl-connections-2008` | Lecture Notes on Bundles and Connections | Draft of 26 September 2008 (chapter PDFs) | Author's explicit statement: free use and copying for any non-comme… | open | yes: www.mathematik.hu-berlin.de | 2026-10-30 | 12 | MAT-262 (suppl.) |

## Findings that changed the plan

- **OpenStax Chemistry 2e is not CC BY 4.0 as the brief and the earlier draft of this file
  assumed.** The preface as seen on 2026-10-30 states CC BY-NC-SA 4.0 and forbids ingestion into
  generative-AI offerings without written permission. It is recorded as readable online,
  reference-only, `importAllowed: false`; CHE-101 links to it and never passes its text to a model.
- Author-hosted notes with no licence statement (Gudmundsson, Hitchin, Tao, Tong, Carroll's
  notes, probmods.org) are reference-only even when the PDF is free to download. MAT-262's main
  reading is in this category; its licensed path runs through Sternberg (CC BY-NC-SA 2.0) and
  Wendl (author's explicit non-commercial permission).
- The only commercial text named by a launch course is Lee, *Introduction to Riemannian
  Manifolds* (MAT-262, recommended); the catalogue-derived acquisition request appears under
  Library → Books to obtain.

## Rights notes

Imperial's student copyright guidance restricts uploading its teaching materials to websites and
AI tools; the app never asks for Imperial credentials and labels Imperial material as not to be
imported. Library ebooks default to reference-only. Code licences are recorded separately from
content permissions (`codeLicence`) in `content/sources/*.json`.
