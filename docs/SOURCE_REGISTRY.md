# Source registry

Machine-readable records live in `content/sources/*.json` (title, authors/institution,
edition/year, canonical URL, licence, access status, components seen, verification date, verified
locators, limitations, rights notes). The table below summarises those records; course manifests
and review ledgers record the narrower passages actually used and checked for teaching.
"Verified" means an agent opened the page on the stated date and recorded what it saw; it never
means every sub-resource was audited. The `limitations` array of each record lists exactly what
was not opened. The current registry has 59 academic sources and 1,166 verified locators.
A locator is not a source-body retrieval: runtime drafting requires actual permissioned library
passages, and preparation, assessment and tutoring recheck availability and consent before
dispatch. Permission to import is separate from permission to send text to an external model.

## Framework references

| ID | Source | Inspected | Status |
|---|---|---|---|
| alter | github.com/dmserrano/alter-learning @ `467daa5c` (2026-09-01) | 2026-10-30 | MIT licence. Claude Code plugin: skills advisor, librarian, tutor, editor, roommate, flashcards; conventions in `skills/alter/reference/conventions.md`. Role structure adapted; no code copied. |

## Academic sources (59 records)

"Import" means the worker may fetch the files named by verified locators from the listed hosts
under the recorded licence. External-AI use also requires the item's recorded action permission.
Other records remain reference-only unless their rights and item permissions allow more; an
owner toggle is not a substitute for rights that the source explicitly withholds.

| ID | Source | Version used | Licence as recorded | Access | Import | Verified | Locators | Used by |
|---|---|---|---|---|---|---|---|---|
| `bayes-rules` | Bayes Rules! An Introduction to Applied Bayesian Modeling | Online edition (build dated 2021-12-01 on the home page) | CC BY-NC-SA 4.0 | open | yes: www.bayesrulesbook.com | 2026-10-31 | 4 | shelf MBI-04 |
| `binz-centaur-2025` | A foundation model to predict and capture human cognition (Centaur) | arXiv:2410.20268v3 (28 April 2025), 'Centaur: a foundation model of human cognition' (v1 26 October 2024; v2… | CC BY 4.0 | open | yes: arxiv.org | 2026-10-31 | 5 | COG-260 (suppl.), shelf MBI-11 |
| `blokpoel-vanrooij-theoretical-modeling` | Theoretical modeling for cognitive science and psychology | Online edition (© 2025; citation dated 2021-2025; no version number; viewed 2026-10-31) | CC BY 4.0 (text); Scala code GPL v3 or later (printed as 'UGN GPL v3') | open | yes: computationalcognitivescience.github.io | 2026-10-31 | 3 | shelf MBI-01 |
| `carroll-gr-notes` | Lecture Notes on General Relativity | arXiv gr-qc/9712019 v1 (3 December 1997); author's chapter PDFs on preposterousuniverse.com | Author copyright; arXiv assumed non-exclusive distribution licence (1… | readable online; reference-only | no | 2026-10-30 | 10 | PHY-240 (suppl.) |
| `cruwell-evans-2021` | Preregistration in diverse contexts: a preregistration template for the application of co… | Published article, Royal Society Open Science 8(10): 210155 (13 October 2021), PMC8511762 | CC BY 4.0 | open | no | 2026-10-31 | 4 | shelf MBI-12 |
| `daw-2011-model-based-influences` | Model-based influences on humans' choices and striatal prediction errors | Author manuscript NIHMS280176 in PubMed Central, PMC3077926 (available in PMC 24 March 2012); published in fi… | CC BY 3.0 ('Open Access under CC BY 3.0 license.' on the PMC page) | open | no | 2026-10-31 | 11 | COG-250 (suppl.), shelf MBI-09 |
| `deepseek-r1` | DeepSeek-R1 incentivizes reasoning in LLMs through reinforcement learning | Nature 645(8081), 633–638 (2025); received 14 February 2025, accepted 17 July 2025, published 17 September 20… | CC BY 4.0 | open | no | 2026-10-31 | 5 | shelf MBI-10 |
| `dezfouli-2019-models-that-learn` | Models that learn how humans learn: The case of decision-making and its disorders | PLoS Computational Biology 15(6): e1006903, published 11 June 2019 | Creative Commons Attribution License (version not stated in the artic… | open | yes: journals.plos.org | 2026-10-31 | 7 | COG-260 (suppl.), shelf MBI-06 |
| `eckstein-2022-parameter-context` | The interpretation of computational model parameters depends on the context | eLife 11:e75474, published 4 November 2022 | CC BY 4.0 (Creative Commons Attribution License) | open | yes: elifesciences.org | 2026-10-31 | 10 | COG-260 (suppl.), shelf MBI-05 |
| `fischer-karl-2019` | A Primer to (Cross-Cultural) Multi-Group Invariance Testing Possibilities in R | Published article, Frontiers in Psychology 10:1507 (18 July 2019) | CC BY (version not stated in the copyright section) | open | yes: www.frontiersin.org | 2026-10-31 | 3 | shelf MBI-05 |
| `flake-fried-2020` | Measurement Schmeasurement: Questionable Measurement Practices and How to Avoid Them | Published article (author-hosted PDF; pages 1-10; received 1/17/19, revision accepted 6/21/20) | © The Author(s) 2020; no open licence found (SAGE reuse guidelines) | readable online; reference-only | no | 2026-10-31 | 2 | shelf MBI-05 |
| `gershman-cfcn` | Computational Foundations of Cognitive Neuroscience | Draft, 'Last update: 10/05/2026' as printed on the textbook page (opened 2026-10-31) | CC BY 4.0 (textbook page) | open | yes: gershmanlab.com | 2026-10-31 | 6 | COG-250 (suppl.), shelf MBI-01, MBI-06, MBI-08, MBI-09 |
| `gudmundsson-riemannian` | An Introduction to Riemannian Geometry (Lecture Notes in Mathematics) | Version 1.438 (6 May 2026), author-hosted PDF | Not stated (author-hosted; copyright presumably the author's) | readable online; reference-only | no | 2026-10-30 | 43 | MAT-262 (primary) |
| `gureckis-ccm-2026` | Computational Cognitive Modeling (NYU DS-GA 1016 / PSYCH-GA 3405.004), Fall 2026 course s… | Fall 2026 offering, live site (course-note chapters marked DRAFT; chapter 'Updated' dates seen: October 1, 26… | CC BY-NC-SA 4.0 unless otherwise noted (site content) | open | yes: teaching.gureckislab.org | 2026-10-31 | 6 | shelf MBI-01 |
| `hafner-dreamerv3` | Mastering diverse control tasks through world models (DreamerV3) | arXiv:2301.04104v2 (17 April 2024; v1 10 January 2023), 'Mastering Diverse Domains through World Models' | CC BY 4.0 | open | yes: arxiv.org | 2026-10-31 | 5 | shelf MBI-10 |
| `hedge-2018-reliability-paradox` | The reliability paradox: Why robust cognitive tasks do not produce reliable individual di… | Behavior Research Methods 50(3), 1166-1186 (publication date 2018/06 in the Springer metadata); published onl… | CC BY 4.0 (Creative Commons Attribution 4.0 International License) | open | yes: link.springer.com | 2026-10-31 | 14 | COG-260 (suppl.), shelf MBI-05 |
| `hitchin-manifolds-2014` | Differentiable Manifolds (Course C3.3b 2014) — lecture notes | Course C3.3b 2014 (manifolds2014.pdf) | Not stated (author-hosted; copyright presumably the author's) | readable online; reference-only | no | 2026-10-30 | 23 | MAT-261 (suppl.) |
| `huys-2012-bonsai-trees` | Bonsai Trees in Your Head: How the Pavlovian System Sculpts Goal-Directed Choices by Prun… | PLoS Computational Biology 8(3): e1002410, published 8 March 2012 (received 14 September 2011, accepted 18 Ja… | Creative Commons Attribution License (version not stated in the artic… | open | yes: journals.plos.org | 2026-10-31 | 8 | COG-250 (suppl.), COG-260 (suppl.), shelf MBI-09 |
| `jhangiani-research-methods` | Research Methods in Psychology (Jhangiani, Chiang, Cuttler, and Leighton) | LibreTexts remix of the KPU fourth edition (book page last modified 15 Aug 2024) | CC BY-NC-SA 4.0 | open | yes: socialsci.libretexts.org | 2026-10-31 | 4 | shelf MBI-05 |
| `jonas-kording-2017` | Could a Neuroscientist Understand a Microprocessor? | Published version, PLOS Computational Biology 13(1): e1005268 (January 12, 2017) | Creative Commons Attribution License (version not stated in the copyr… | open | yes: journals.plos.org | 2026-10-31 | 3 | shelf MBI-01, MBI-02 |
| `judson-aata` | Abstract Algebra: Theory and Applications | HTML edition at judsonbooks.org (title block dated August 4, 2026; the site's book page lists the HTML editio… | GNU Free Documentation License, Version 1.2 or any later version; no… | open | yes: judsonbooks.org | 2026-10-30 | 65 | MAT-270 (primary) |
| `jurafsky-martin-slp3` | Speech and Language Processing (3rd ed. draft) | 3rd edition draft, August 19, 2026 release | All rights reserved (Copyright © 2026 Jurafsky & Martin, draft); info… | readable online; reference-only | no | 2026-10-31 | 4 | shelf MBI-10 |
| `lake-gureckis-ccm-2024` | Computational cognitive modeling, Spring 2024 (NYU PSYCH-GA 3405.004 / DS-GA 1016.003) | Spring 2024 offering (archived; most recent repository commit 2 May 2024, 'update link') | MIT License (repository LICENSE); no separate content licence stated | open | yes: brendenlake.github.io, github.com, raw.githubusercontent.com | 2026-10-31 | 5 | shelf MBI-04 |
| `lee-riemannian` | Introduction to Riemannian Manifolds (Second Edition) | 2nd edition (2018), Springer GTM 176 | All rights reserved (Springer International Publishing AG 2018); comm… | commercial; reference-only | no | 2026-10-30 | 19 | MAT-262 (suppl.) |
| `mit-algebra-2010` | 18.701 Algebra I | Fall 2010 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 4 | MAT-270 (suppl.) |
| `mit-algebra-notes-2021` | RES.18-011 Algebra I Student Notes | Fall 2021 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 15 | MAT-270 (suppl.) |
| `mit-chem-2014` | 5.111SC Principles of Chemical Science | Fall 2014 (OCW Scholar publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-11-12 | 128 | CHE-101 (primary) |
| `mit-cm3-2014` | 8.09 Classical Mechanics III | Fall 2014 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 28 | PHY-201 (primary) |
| `mit-cocosci-2004` | 9.66J Computational Cognitive Science (Fall 2004) | Fall 2004 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 102 | COG-201 (primary), shelf MBI-01, MBI-03 |
| `mit-cognitive-science` | Computational Cognitive Science (9.66J / 9.660 / 6.804J) — CBMM course entry page | CBMM course page as published (semester shown: Fall 2021; opened 2026-10-30) | Not stated; CBMM copyright notice and Terms of Use | readable online; reference-only | no | 2026-10-30 | 1 | COG-201 (suppl.) |
| `mit-fa-2021` | 18.102 Introduction to Functional Analysis | Spring 2021 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 62 | MAT-230 (primary) |
| `mit-gm-2004` | 18.965 Geometry of Manifolds | Fall 2004 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 60 | MAT-261 (primary) |
| `mit-gr-2020` | 8.962 General Relativity | Spring 2020 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 24 | PHY-240 (primary) |
| `mit-human-brain-2019` | 9.13 The Human Brain (Spring 2019) | Spring 2019 (OCW publication; footer © 2001–2026 Massachusetts Institute of Technology) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-31 | 6 | shelf MBI-01, MBI-02 |
| `mit-measure-2003` | 18.125 Measure and Integration | Fall 2003 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 54 | MAT-210 (primary) |
| `mit-neural-computation-2018` | 9.40 Introduction to Neural Computation (Spring 2018) | Spring 2018 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-31 | 4 | shelf MBI-02, MBI-08 |
| `mit-sr-2021` | 8.20 Introduction to Special Relativity | January IAP 2021 (OCW publication) | CC BY-NC-SA 4.0 | open | yes: ocw.mit.edu | 2026-10-30 | 7 | PHY-210 (suppl.) |
| `neuromatch-compneuro` | Neuromatch Academy: Computational Neuroscience (course book) | Course book as published online (repository syllabus dated July 7–25, 2025; book marked 'under continuous dev… | CC BY 4.0 (content); code separately BSD-3-Clause | open | yes: compneuro.neuromatch.io | 2026-10-30 | 36 | NEU-220 (primary), shelf MBI-01, MBI-02, MBI-04, MBI-06, MBI-08 |
| `neuromatch-deep-learning` | Neuromatch Academy: Deep Learning (course ebook) | Online ebook, rolling publication (opened 2026-10-30) | CC BY 4.0 (content); BSD 3-Clause (software) | open | yes: deeplearning.neuromatch.io | 2026-11-12 | 39 | CSA-210 (primary), shelf MBI-07 |
| `neuromatch-neuroai` | Neuromatch Academy: NeuroAI (course book) | Course book as published online (MyST build; repository syllabus dated July 14-25, 2025; marked 'under contin… | CC BY 4.0 (content, per repository README and LICENSE.md); code separ… | open | yes: neuroai.neuromatch.io | 2026-10-31 | 4 | COG-260 (suppl.), shelf MBI-07, MBI-08, MBI-11 |
| `neuroscience-online` | Neuroscience Online: An Electronic Textbook for the Neurosciences | Online edition (home page 'Last Revision or Edit: 13 January 2026'; chapters carry their own revision dates;… | No licence stated; 'Contents © 1997-Present - McGovern Medical School… | readable online; reference-only | no | 2026-10-31 | 4 | shelf MBI-02, MBI-08 |
| `noba-psychology` | Noba textbook series: Psychology (modules) | Modules as published online (module citations dated 2026; '© 2026 Diener Education Fund'; viewed 2026-10-31) | CC BY-NC-SA 4.0 | open | yes: nobaproject.com | 2026-10-31 | 4 | shelf MBI-03 |
| `oh-gobet-small-foundation-models` | Small Foundation Models of Human Cognition and Behaviour | arXiv:2608.05224v3 (11 August 2026; v1 5 August, v2 9 August 2026); pages headed 'Published as a conference p… | CC BY 4.0 | open | yes: arxiv.org | 2026-10-31 | 5 | COG-260 (suppl.), shelf MBI-11 |
| `openstax-chemistry` | Chemistry 2e | 2nd edition, web view (publication date 14 Feb 2019 shown on the preface; viewed 2026-10-30) | CC BY-NC-SA 4.0 (as stated on the preface page, 2026-10-30), with Ope… | readable online; reference-only | no | 2026-10-30 | 68 | CHE-101 (suppl.) |
| `prince-udl` | Understanding Deep Learning | Free PDF dated 'February 8, 2026' on its title page (GitHub release v5.0.3 'Understanding Deep Learning Chapt… | Creative Commons CC-BY-NC-ND (as printed in the PDF); repository LICE… | open | yes: github.com | 2026-10-31 | 6 | shelf MBI-07, MBI-10 |
| `probmods-v2` | Probabilistic Models of Cognition (2nd edition) | 2nd edition, web (cited as 2016; server Last-Modified 2023-06-05; opened 2026-10-30) | Not stated (site: 'This book is an open source project'); treated as… | readable online; reference-only | no | 2026-10-30 | 26 | COG-201 (primary), COG-250 (suppl.), shelf MBI-03, MBI-04, MBI-06, MBI-09, MBI-11 |
| `psych-101` | Psych-101 | Hugging Face dataset as listed on 2026-10-31 (one 'train' split, 60,092 rows, 859 MB; no version tag shown) | Apache-2.0 (dataset card) | open | no | 2026-10-31 | 2 | COG-260 (suppl.), shelf MBI-11 |
| `stanford-cs336` | CS336: Language Modeling from Scratch | Spring 2026 offering (course page; Assignment 1 handout 'Version 26.0.3', 'CS336 Staff', 'Spring 2026') | No licence stated for course content (all rights reserved by default)… | readable online; reference-only | no | 2026-10-31 | 4 | shelf MBI-10 |
| `sternberg-semi-riemannian` | Semi-Riemann Geometry and General Relativity | 24 September 2003 (author-hosted PDF) | CC BY-NC-SA 2.0 (stated on the author's books page) | open | yes: people.math.harvard.edu | 2026-10-30 | 19 | MAT-262 (primary) |
| `sutton-barto-rl-2e` | Reinforcement Learning: An Introduction (second edition) | Second edition (MIT Press, 2018), author-hosted full PDF RLbook2020.pdf: copyright page '© 2018, 2020'; 548 P… | Creative Commons Attribution-NonCommercial-NoDerivs 2.0 Generic (CC B… | open | yes: incompleteideas.net | 2026-10-31 | 22 | COG-250 (primary), shelf MBI-06, MBI-09 |
| `tao-measure-theory` | An Introduction to Measure Theory | 2011 (GSM 126) with author-hosted online draft (PDF uploaded December 2012) | No licence stated on the author's pages; copyright in the printed boo… | readable online; reference-only | no | 2026-10-30 | 2 | MAT-210 (suppl.) |
| `taylor-wheeler-spacetime-physics` | Spacetime Physics: Introduction to Special Relativity (Second Edition) | Second edition (W. H. Freeman, 1992), authors' CC BY 4.0 scans on eftaylor.com | CC BY 4.0 | open | yes: www.eftaylor.com | 2026-11-12 | 46 | PHY-210 (primary) |
| `tolman-1948-cognitive-maps` | Cognitive maps in rats and men | Web transcription at Classics in the History of Psychology (original: Psychological Review 55(4), 189-208, 19… | Public domain, as stated in the host's site-wide copyright note (no s… | readable online; reference-only | no | 2026-10-31 | 10 | COG-250 (suppl.), shelf MBI-09 |
| `tong-classical-dynamics` | Classical Dynamics (lecture notes) | Web edition on davidtong.org (undated; HTML version generated 2022-03-24) | No licence stated; author copyright (free to read on the author's pag… | readable online; reference-only | no | 2026-10-30 | 17 | PHY-201 (suppl.) |
| `tong-dynamics-relativity` | Dynamics and Relativity (lecture notes) | Web edition on davidtong.org (undated) | No licence stated; author copyright (free to read on the author's pag… | readable online; reference-only | no | 2026-10-30 | 13 | PHY-201 (suppl.), PHY-210 (suppl.) |
| `tong-general-relativity` | General Relativity (lecture notes) | Web edition on davidtong.org (undated; HTML version generated 2021-10-15) | No licence stated; author copyright (free to read on the author's pag… | readable online; reference-only | no | 2026-10-30 | 16 | PHY-240 (suppl.) |
| `turing-way` | The Turing Way | Online handbook, rolling community publication (MyST build; no version number shown; viewed 2026-10-31) | CC BY 4.0 (content); MIT (code) | open | yes: book.the-turing-way.org | 2026-10-31 | 4 | shelf MBI-12 |
| `wendl-connections-2008` | Lecture Notes on Bundles and Connections | Draft of 26 September 2008 (chapter PDFs) | Author's explicit statement: free use and copying for any non-commerc… | open | yes: www.mathematik.hu-berlin.de | 2026-10-30 | 12 | MAT-262 (suppl.) |
| `wilson-collins-2019-ten-rules` | Ten simple rules for the computational modeling of behavioral data | Version of Record, eLife 8:e49547, published 26 November 2019 (received 26 June 2019, accepted 9 October 2019… | CC BY 4.0 (Creative Commons Attribution License) | open | yes: elifesciences.org, cdn.elifesciences.org | 2026-10-31 | 29 | COG-260 (primary), shelf MBI-04, MBI-06, MBI-11, MBI-12 |

## Source evidence for the five complete courses

The 54-unit, 195-exercise package has separate author/source records, independent solution
checks and final repair review. These records describe actual inspected passages; they do not
claim a line-by-line audit of whole books or optional readings. Source bodies stay outside git.

| Course | Working source and current evidence | Boundary |
|---|---|---|
| CHE-101 | MIT 5.111SC notes, including actual lectures 20–29 and 34–35 bodies and 45 added page locators; [manifest](../content/courses/CHE-101/source-review-manifest.json), [science review](../.codex/quality-loop/university-teaching-quality/SCIENCE_REVIEW.md) | Fill-in notes need explanatory derivations; third-party figures are not copied. OpenStax remains human reference-only and supplies no AI-ingested body. |
| PHY-210 | Taylor–Wheeler second-edition chapters and Lorentz special topic; selected Tong chapter 7 passages; [manifest](../content/courses/PHY-210/source-review-manifest.json), [physics review](../.codex/quality-loop/university-teaching-quality/PHYSICS_REVIEW.md) | OCR needs visual care; the independent pass does not reread all of chapter 3 or watch whole MIT videos. The old neutrino/null examples and Tong Higgs branching claim are explicitly corrected. |
| MAT-230 | MIT 18.102 lecture text; complete independent reasoning for all 44 exercises, including Hahn–Banach, Lp completeness and spectral proof portfolios; [maths review](../.codex/quality-loop/university-teaching-quality/MATHS_REVIEW.md) | Source inspection is passage-specific; the Green-kernel sign is corrected and classical regularity is distinguished from L2 convergence. |
| MAT-261 | MIT 18.965 actual lecture notes with repaired download URLs; targeted Hitchin homotopy/Stokes passages; all 43 exercise solutions independently checked | Terse/unfinished source proofs receive explicit teaching detail. Strong Whitney, global Reeb and general good-cover inputs retain stated proof boundaries; optional sources are not all audited. |
| CSA-210 | Actual Neuromatch tutorial passages and code; [manifest](../content/courses/CSA-210/source-review-manifest.json), [science review](../.codex/quality-loop/university-teaching-quality/SCIENCE_REVIEW.md) | Videos, source datasets and pretrained models are not imported or claimed as reviewed. Original CPU examples and the capstone are executed; synthetic observations do not establish real-world performance. |

The lead's [independent solution record](../.codex/quality-loop/university-teaching-quality/LEAD_ACADEMIC_REVIEW.md)
covers all 75 chemistry/CS answers and the executed CS code. The separate science reviewer reads
all 20 lessons and the specified assessment samples; it does not claim a second fresh solution of
every one of those 75 exercises. Maths and physics coverage and post-repair scope are recorded in
their own reports. These are independent agent checks, not external expert certification or
empirical learning validation. Older dated locator notes describe their original inspection;
newer manifests and review records give the additional inspected scope.

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

- **Host terms, not only licences, decide imports.** PubMed Central forbids automated downloading
  outside its own services and nature.com's terms allow only ordinary browser access, so no record
  lists either as an import host, even for CC BY articles. Daw et al. (2011), Crüwell and Evans
  (2021) and the Nature versions of Centaur, DeepSeek-R1 and DreamerV3 are read in the browser.
  For Centaur and DreamerV3 the CC BY arXiv preprints are the working copies that may be imported;
  the Nature articles stay the versions of record. DeepSeek-R1's arXiv version grants no reuse.
- **Psych-101 is not imported.** The dataset is about 859 MB, so fetching it would be a bulk
  download, which needs the owner's decision; its gated test set may not be redistributed.
- **Prince, *Understanding Deep Learning*, cannot be imported automatically.** GitHub serves the
  release PDF through a redirect, which the importer never follows; the book is CC BY-NC-ND, so it
  may be read and kept for private study but no adapted text or figure is shared.
- **Tolman (1948) is reference-only.** Its public-domain status rests on the host's report of what
  APA officials told it, which was not confirmed first-hand.
- **Sutton and Barto (2nd ed.) is CC BY-NC-ND 2.0.** It is imported for private study only, and
  lessons are written in Corniversity's own words.
- **Gershman's textbook is a draft that changes in place.** Only its CC BY chapter PDFs are
  locators, so only they can be imported; its slides and mini-projects state no licence.
- **Oh and Gobet (2026) was identified from its authors and topic.** The plan that first named the
  lead was not available to the verifier, and its COLM 2026 publication is stated by the paper,
  not checked against the proceedings.

## Rights notes

Imperial's student copyright guidance restricts uploading its teaching materials to websites and
AI tools; the app never asks for Imperial credentials and labels Imperial material as not to be
imported. Library ebooks default to reference-only. Code licences are recorded separately from
content permissions (`codeLicence`) in `content/sources/*.json`.
