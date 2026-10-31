## Lesson notes (instructor only)

Source mapping (OCW 9.66J Fall 2004 slides, text extracted 2026-10-30; page numbers are PDF pages, index + 1; neither deck has printed labels). Lecture 1, sept_9_2004.pdf (72 pp.): "The problem of induction" p. 10; "Induction versus Deduction" pp. 11–14; Mill quotation p. 17; "Computational approaches to induction" (two ingredients) p. 18; "Cognition as inductive inference" p. 23; everyday induction pp. 24–29 (avian flu p. 24, mammogram p. 27); "Marr's three levels" p. 43; "Hume's problem" p. 48; "A modern answer to Hume?" p. 49; "Goodman's problem" p. 50; "Responses to Goodman" pp. 51–53 (symmetry p. 53); "Plato meets Matlab" pp. 58–61; "Goodman's answer to Goodman" p. 70. Lecture 2, sept_14_2004.pdf (65 pp.): "Inductive learning as search" p. 26; "Marr's three levels" p. 27; level questions p. 28; "Level 1: Computational Theory" p. 29; "Level 2: Representation and Algorithm" p. 30; identification in the limit p. 42; PAC intuition p. 47; PAC theorem p. 51; "The role of inductive bias" p. 58; "What this doesn't tell us" p. 60; summary p. 65. Lecture 2 reuses lecture 1's Goodman slides as pp. 1–25.

The Mill quotation on slide 17 is a public-domain text (1843) reproduced on a CC BY-NC-SA slide; quoting it is fine. The lesson paraphrases rather than quotes other slide text.

Derived versus source-backed: the PAC statement is on slide 51; the union-bound *proof* and the hypothesis-space counts ($3^k$, $2^{2^k}$) are derived in the lesson, not on the slides (slide 56 states only $\log|H|=\log k$ for single features). Label them "derived" when the learner asks. The identification-in-the-limit mistake bound of $k$ is on slide 42.

Teaching intent: the learner's probability background makes the PAC proof a ten-minute exercise; the tutorial time should go to the assumptions (where i.i.d. enters) and to the four-way labelling, which is the habit this course installs. Exercise 3 uses a paraphrased number-game paragraph deliberately before unit 2 teaches the model, so that labelling is practised on an unfamiliar case; the tutor should not pre-teach the number game here.

Probmods Introduction: reference-only (no licence stated); the learner reads it on the book's site; the tutor may discuss but must not paste its text.

Staged misconception for a peer discussion, if enabled: a classmate may say "PAC learning shows induction is justified after all". The tutor resolves it in the same discussion with the i.i.d. same-distribution assumption, citing slide 49.
