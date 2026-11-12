# Independent mathematics academic review — 12 November 2026

Reviewer: independent `maths_review` agent, separate from the course author. Repository: `/home/leon/work/Corniversity`, branch `codex/university-teaching-quality`. This is a pre-repair handoff, not a final approval. At the lead's request the review stops at the exact coverage below so the author can repair the findings and add the missing proof assessments. The reviewer changed no teaching files.

## Snapshot and exact coverage

Reviewed the author's MAT-230 v2 (12 units, 40 exercises) and MAT-261 v3 (12 units, 42 exercises). Local read snapshot: `/tmp/corniversity-independent-maths-review/{MAT-230,MAT-261}`. The course.json SHA-256 values were respectively `65e81783d42b0cfe3109a0dcb0390af5beadb40a3d62ce497c37e9b022d27dd4` and `5075729f2315bb6aaf12dd558e8a14c446d05c58b31f5c711ac5ae113c853fef`. These identify the course manifests, not a hash of every teaching artifact. Line references below are to this snapshot and may move during repair.

- Read all 24 lessons, course outcomes/assessment specifications, and all 24 unit objective/misconception/exit-check records. The last two geometry lessons were also available in the supplied review context. Examined the course source maps, corrections and coverage claims; author claims were not treated as independent evidence.
- Independently read the full prompts and private reference solutions for **all 40 MAT-230 exercises**, recomputing their substantive arguments.
- Independently read the full prompts and private reference solutions for **all 34 MAT-261 exercises in units 01–10**, recomputing their substantive arguments.
- Read the inherited private grading notes for MAT-230 units 01–04 and MAT-261 units 01–02 in full. They were not assumed correct merely because they predated this authoring pass.
- Thus this reviewer independently recomputed **74 of 82 reference solutions**, not 82. The remaining eight MAT-261 solutions in units 11–12 were not freshly recomputed by this reviewer before handoff. Their assessment prompts/objectives were inspected for the alignment findings below. The lead reported a separate independent derivation pass through those units; that is separate evidence, not this reviewer's work.
- This is not an exhaustive independent audit of every rubric sentence, hint, deterministic check or every assigned-source page. It does not close AC-05 by itself. A final post-repair review is still required.

## Actionable findings

All findings below are **open at handoff**. The lead was informed of the P1/P2 issues as they were found. Repair the teaching and assessment materials without weakening the retained course promises.

### MATH-R01 — P1 — Incorrect differentiability definition

Location: `content/courses/MAT-261/units/02-smooth-maps-pathologies-and-the-derivative/lesson.md:41` (and uniqueness proof at line 45).

The explanation of `o(||h||)` requires only that the displayed remainder function be continuous at zero and vanish there. That is not little-o relative to `||h||`. It permits `f(x)=|x|` at zero with proposed derivative zero and does not justify dividing by `|t|` in the uniqueness proof. This is inherited from MIT Lecture 3, Definition 4.1, printed page 7; the actual PDF was rendered and visually checked, so it is not merely an extraction artifact.

Correction: state `||f(x+h)-f(x)-Lh||/||h|| -> 0` as `h -> 0`, `h != 0`, equivalently a remainder bounded by `||h|| epsilon(||h||)` with `epsilon(r) -> 0`. Record the source correction in MAT-261/corrections.md and retain the correct uniqueness argument. Check the derivative examples against this repaired definition.

### MATH-R02 — P2 — Instructor grading note rejects a valid counterexample

Location: `content/courses/MAT-230/units/03-subspaces-quotients-and-baire-category/instructor/MAT-230-u03-ex3.grading-notes.md:5`.

The note says the alternative `T_n(x)=sum_{k<=n}x_k` is uniformly bounded on `c00` with the sup norm and therefore invalid. In fact `||T_n||=n`: the triangle inequality gives the upper bound and the vector whose first n coordinates are one gives equality. For each fixed finitely supported x, the partial sums eventually become constant. It is another valid pointwise-bounded, non-uniformly-bounded family.

Correction: remove the false rejection and explicitly accept this alternative with the norm calculation. The given main example `T_n(x)=n x_n` and its current reference solution are correct.

### MATH-R03 — P2 — Quotient completeness is used before being taught

Locations: `content/courses/MAT-230/units/03-subspaces-quotients-and-baire-category/lesson.md:17` and `:53`; `exercises/MAT-230-u03-ex4.json:6`; `instructor/MAT-230-u03-ex4.reference-solution.md:3` in the same unit.

The lesson defines the quotient norm, then its carry-forward paragraph claims completeness passes to closed-subspace quotients. The new exercise and reference rely on that theorem for ell-infinity/c0, but the lesson never states/proves it. The assigned Lecture 3 discussion does not supply the missing completeness proof either.

Correction: add the theorem for Banach V and closed W, with a short proof. For example use the absolutely summable series criterion: lift quotient terms q_j to v_j with `||v_j|| <= 2||q_j||` (zero terms lifted by zero), sum in V, and pass to the quotient. Establish or cite the summable-series characterization of completeness precisely. A direct rapidly Cauchy subsequence/lifting proof is equally suitable.

### MATH-R04 — P2 — Explicit proof outcomes lack corresponding assessed proof work

Locations and bounded repairs:

1. `content/courses/MAT-230/units/05-hahn-banach-and-the-double-dual/unit.json:10`: objective promises a proof of real Hahn–Banach from one-dimensional extension and Zorn. The three current exercises apply Hahn–Banach or examine reflexivity; none requires that proof. Add a proof portfolio/task with the one-dimensional interval inequality, maximal extension, and norm-preservation argument, complete private solution and rubric.
2. `content/courses/MAT-230/units/08-integrable-functions-dominated-convergence-and-lp/unit.json:18`: objective promises Riesz–Fischer completeness. Current power/spike/typewriter exercises do not assess the full summable-subsequence proof. Add an explicit proof task and assess the almost-everywhere convergent series, Lp bound, convergence to the limit, and recovery of the whole Cauchy sequence; distinguish the p=infinity case if it is included in the claim.
3. `content/courses/MAT-230/course.json:41`: course outcome says “Prove and apply” the compact self-adjoint spectral theorem. Unit 12's lesson gives a proof architecture/source dependency, and its three current exercises apply the theorem. Require a complete proof exposition as part of the final portfolio, with the eigenvector existence/completeness and kernel cases, rather than treating a successful Green-operator application as proof mastery.
4. `content/courses/MAT-261/units/11-differential-forms-and-de-rham-cohomology/unit.json:14` and `content/courses/MAT-261/course.json:36`: construct homotopy operator/prove Poincare is promised. Exercise 2 applies the radial formula and exercise 4 applies homotopy to cohomology; neither explicitly requires derivation of the operator identity. Add an explicit derivation part, including the sign in `dK+Kd=H_1^*-H_0^*`, degree-zero qualification, and star-shaped contraction.
5. `content/courses/MAT-230/course.json:115`: “Mid-course synthesis” is specified in the course assessment list but has no concrete corresponding assessment sheet. Provide the actual cumulative task after unit 6 and its solution/rubric. MAT-261 unit 6 exercise 4 already supplies a concrete mid-course embedding portfolio; do not duplicate it unnecessarily.

These are assessment alignment gaps, not claims that the named theorems are false or absent from all reading. Generic exit-check wording asking for an “independent account” of a main theorem is weaker than the explicit assessed proof with reference/rubric promised by this build. Geometry's full Frobenius proof task (unit 10 exercise 4) and de Rham synthesis task are positive examples of the desired alignment.

### MATH-R05 — P2 — Assigned primary-source errors still need reader-facing annotations

Locations: MAT-230/corrections.md and assigned readings in MAT-230 units 08, 11 and 12. The authored mathematical statements are correct in these places, but the required readings contain conflicting errors that can mislead a learner following the course.

- **Lecture 13, Corollary 137, printed page 67 (PDF page 3):** the source gives a lower bound `|f(x)| >= C(1+|x|)^(-q)` as a sufficient condition for Lp integrability. It must be an upper bound. The constant function one is a counterexample to the printed lower-bound claim. Actual PDF rendered and visually checked.
- **Lecture 20, Proposition 213 proof:** the Neumann factorization writes a minus sign where `I + T0^{-1}(T-T0) = T0^{-1}T` is needed. The course's perturbation/factorization argument already has the correct order and sign; point learners to that correction.
- **Lecture 23, Theorem 241 proof:** multiplication by the continuous potential is called compact. It is bounded and self-adjoint for real V, but need not be compact; V=1 gives the identity on infinite-dimensional L2. Compactness of the Green square-root factors proves compactness of `G^(1/2) M_V G^(1/2)` instead. The course already uses this valid reasoning. Add the source erratum, not a change to the correct authored proof.

### MATH-R06 — P3 — Make the resonance forcing hypothesis explicit

Location: `content/courses/MAT-230/units/12-the-spectral-theorem-and-the-dirichlet-problem/exercises/MAT-230-u12-ex2.json:6`.

The problem asks for a unique L2 spectral solution but never declares a function space for f. State `f in L2(0,1)` explicitly, with continuous f as the optional classical-solution strengthening. The coefficient reference argument is then correct. It should not be read as a theorem for arbitrary forcing.

### MATH-R07 — P3 — Source attribution and dimension precision

- `content/courses/MAT-230/units/01-normed-and-banach-spaces/instructor/lesson-notes.md:3`: the Spring 2021 source header identifies lecturer Casey Rodriguez and notes by Andrew Lin. Prefer that precise identification. A historical statement that the notes follow Melrose's 2020 notes is distinct and was not independently established in this review.
- MAT-261 unit 1's no-global-chart argument for S^n uses noncompactness of R^n. State n>=1 or separately handle S^0. The conclusion is still true for S^0, but that argument does not cover it.

## Independent recomputation evidence

These are records of the main checks, not a claim that numerical checks replace proofs.

### MAT-230, all exercises in units 01–12

- 01–04: norm axioms/equivalence, continuous-function completeness and integral-norm failure, Volterra iterates and the factorial norm bound, completeness of bounded-operator and dual spaces; polynomial exponential approximation; finite-dimensional closedness/Baire Hamel obstruction; both uniform-boundedness examples; the quotient norm as limsup, independent cosets and closedness of c0; C1 with sum norm via FTC; derivative-operator norm and non-attainment; closed graph/incomplete domain; Zorn chain union. The quotient completeness teaching gap and wrong alternative-example grading note are recorded above.
- 05–08: distance functional and Hahn–Banach norm estimate; l1 extension parameter interval versus Euclidean uniqueness; bidual isometry/reflexivity/completeness distinction; Borel–Cantelli without independence and category-versus-measure examples; monotone/Fatou examples and fixed lower bound; power integrability thresholds; spike Lp scaling `n^(alpha-1/p)` and domination threshold; typewriter convergence in finite Lp with failure at every point of [0,1). No additional incorrect reference conclusions found in this group.
- 09–12: least-squares affine approximation `x-1/6`, residual squared norm `1/180`; incomplete even orthonormal family; sine series coefficients `2(-1)^(n+1)/n` and Parseval; l2 minimum norm `sqrt(3)` and extremizer `3(2^(-n))`; shifts/adjoints/ranges; diagonal compact dense nonclosed range; Neumann factorization and inverse difference; diagonal spectra and limit points; strong versus norm convergence of projections; sharp Green truncation error `((N+1)pi)^(-2)`; resonance compatibility `f_k=0`; nonnegative-potential argument through compact positive `G^(1/2)M_VG^(1/2)` and regularity. Forcing-space precision is recorded above.

### MAT-261, all exercises in units 01–10

- 01–02: stereographic inverse and overlap; real-projective quotient topology/charts; maximal compatible atlas; non-Hausdorff two-origins pathology; corrected direction of the cubic-chart diffeomorphism; circle map of degree two; derivative examples. Little-o definition defect is recorded above.
- 03–05: derivative of `A^T A`, surjectivity onto symmetric matrices and tangent conditions; exponential polar map and cylinder flow; tangent coordinate change; Mobius line bundle/trivial doubled bundle; `TS^n + R` trivialization; connection gluing and transformation; universal finite-cover bundle map; compact embedding by weighted local coordinates. Verified zero extension, injection, rank and compact-to-Hausdorff topology arguments.
- 06–07: critical sets/values and branches of `x^2y`; matrix rank-stratum Schur complement and codimensions; dimensional transversality limitations for avoiding rank loss; compact embedding/projection bad secant and tangent directions; frame-bundle fibre GL(k), not merely injective homomorphisms; punctured-plane nonbundle submersion; space-curve projections and transverse double point; medium Whitney dimension bounds.
- 08: shift indices -1/+1; compact diagonal operator's dense proper nonclosed range, hence not Fredholm; Schur-complement index stability and nullity jump; compact perturbation index zero via parametrix/path, no unjustified small-norm hypothesis; Fredholm cubic family with critical-value hyperplanes `b-<x,a>= +/- 2/(3sqrt(3))` and one/three regular preimages.
- 09: parameterized cubic transverse intersections and exceptional parameters; finite transverse double pairs with explicit uniform exclusion of diagonal accumulation; orientation interchange sign `(-1)^(n^2)`; correct kernel/cokernel/index of parameter projection using `range(L) intersect V`; strong Whitney proof boundary distinguished from general-position immersion.
- 10: flows of `X=partial_x+y partial_z`, `Y=partial_y`, bracket `-partial_z`, four-move displacement `-st`; graph foliation for `z/(1+x^2+y^2)` and contact obstruction; suspension holonomy `y -> 2y` and missing finite-holonomy hypothesis; adapted graph-frame Frobenius proof, commuting flows, irrational dense leaves and non-Hausdorff quotient. No additional incorrect reference conclusions found in these recomputations.

## Primary-source evidence and limitations

Actual cached primary lecture PDFs/text were used from `/tmp/corniversity-source-review-maths`, not merely university titles, source-registry entries or syllabus pages. The author's source inventory is `/tmp/corniversity-maths-source-inventory.json` on the SSH host; this reviewer used the actual cache rather than assuming an inventory assertion was true. Main primary collections: [MIT 18.102 Spring 2021](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/) and [MIT 18.965 Fall 2004](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/). No paid model or runtime generation call was made.

Source work actually completed:

- MAT-261: read full relevant text in Lectures 2–6, 8–9, 13–14, 18–20, 21–22 and 31–34; read Frobenius/leaf sections of Lecture 30. These covered derivative/pathology corrections, split-kernel implicit theorem, partitions/bundles, Sard/projection hypotheses, frame fibres, Fredholm/Sard–Smale, parameter-projection exact sequence, strong Whitney sketch boundary, exterior derivative, homotopy operator gap, Cech sign and partition homotopy. The actual Lecture 3 derivative PDF was visually checked. Course corrections on the cubic-chart direction, frame-bundle fibre, Sard–Smale Fredholm premise, parameter-projection cokernel and Whitney compactness/low-dimensional boundary were independently checked against the relevant text, not just repeated from the author's ledger.
- MAT-230: closely checked relevant passages/proofs in Lectures 1–5 and 13, and selected statements/proofs across 6–23 including the late Neumann/spectral/Green arguments. Lecture 13's inequality was visually confirmed in the PDF. The independent mathematical recomputation above was broader than line-by-line source reading.

**Do not overstate the source pass:** not every page of all 49 source PDFs was read in full by this reviewer. In particular no fresh full reading of geometry Lectures 1, 7, 10–12, 15–17 or 29 was completed here, the end of Lecture 30/Reeb section was not fully rechecked, and portions of the functional-analysis convergence/Hilbert/Fourier source proofs were inspected only selectively. Source retrieval output truncation was not counted as a complete read. Source-specific claims in these regions require the author's evidence and/or the lead's separate review. Optional Hitchin notes and videos were not independently audited here.

## Required completion after this handoff

1. Repair R01–R05 and the small precision items; add the explicit proof portfolios/mid-course assessment while preserving original objectives.
2. Independently derive and review the new proof-task solutions/rubrics. Check all modified lessons and private grading notes after repair.
3. Complete or explicitly attribute the remaining eight MAT-261 unit 11–12 solution derivations to the separate reviewer; do not silently count them as this review's work.
4. Record final source/hypothesis checks for any newly introduced proof claims and close the remaining source-review limits where needed. R01–R05 are not waived because structural validation passes.
5. Run content/schema/rendering checks through the lead's integration process. This academic review did not exercise the production tutor or grading model and provides no evidence of empirical learning gains, external academic certification, or “best university” equivalence.

# Final independent post-repair review — 12 November 2026

This section supersedes the earlier open-finding disposition without erasing that review history. The independent reviewer was recalled after the author's repairs. **MATH-R01 through MATH-R07 are now verified resolved. No P1/P2 academic finding remains from this review.** Three small post-repair consistency findings were reported to the lead, repaired, and independently re-read before this disposition. No course status, teaching content, learner data or runtime service was changed by this reviewer.

## Final snapshot

- MAT-230 **version 3, 12 units, 44 exercises**.
- MAT-261 **version 4, 12 units, 43 exercises**.
- Full course-tree SHA-256 digests at final verification: MAT-230 `8aec17208ea26b2fe4bbc822f848872ba660bd843cfff8116d1ef2f987eea73b`; MAT-261 `fe8fd4a28d97eab0d99e86e37a7ecae202d76ee9624942fa6a84ebe257011431`. Digest recipe: sorted course-relative file paths, each UTF-8 path followed by NUL, exact file bytes, then NUL, accumulated through SHA-256. These hashes cover teaching files as inspected, not this ledger or the rest of the application.
- The local post-repair snapshot is `/tmp/corniversity-independent-maths-final`; the lead's last three small repairs were re-read directly from the SSH repository after that copy.

## Repair disposition

| Finding | Disposition and independently checked repair |
| --- | --- |
| R01 | Resolved. The lesson now defines the vanishing remainder ratio, explains the absolute-value counterexample to the former definition, and retains a valid derivative-uniqueness proof. MAT-261/corrections.md names the actual source defect. |
| R02 | Resolved. The private grading note accepts the partial-sum family, proves its norm is n, and distinguishes pointwise boundedness from a uniform operator bound. |
| R03 | Resolved. The lesson states the closed-subspace quotient completeness theorem and proves it by representative lifts and the already taught summable-series criterion. Zero cosets are lifted by zero; no attainment of the quotient infimum is assumed. |
| R04 | Resolved. All five requested explicit proof/synthesis assessments now exist, have full private references, progressive hints and weighted rubric obligations, and are reachable through unit activities and exit checks. Retained proof outcomes were not weakened. Course assessment descriptions name the concrete mid-course/final tasks. See the independent proof derivations below. |
| R05 | Resolved. Assigned-reading annotations and the correction ledger repair the Lecture 13 decay-inequality direction, Lecture 20 Neumann-factor sign/order, and Lecture 23 multiplication-operator compactness assertion. The correct authored arguments remain intact. |
| R06 | Resolved. Resonance explicitly assumes f in L2 and defines the sine-coefficient Dirichlet domain. The added private reasoning proves the weighted coefficient bound and, for continuous forcing, uniform convergence followed by the Green-integral C2 bridge. |
| R07 | Resolved. Casey Rodriguez/Andrew Lin attribution is explicit and the unverified historical attribution is removed. Sphere task specifies n>=1; the reference separately treats S0 by cardinality. |

Additional consistency repairs, all verified:

- The MAT-230 unit 08 proof-workshop source locators now include **fa21-lec13**, the actual Riesz–Fischer theorem/proof, alongside Lecture 12.
- The MAT-230 unit 12 proof-workshop source locators now include **fa21-lec22**, the actual spectral theorem/proof, alongside Lecture 21.
- Unit 12 lesson line 43 now assigns the provisional two-to-three-hour estimate specifically to exercises 1–3 and separately identifies exercise 4's 210-minute planning estimate. It no longer labels the entire enlarged sheet with the old estimate.

The review compared current and prior teaching artifacts after canonicalizing JSON and ignoring whitespace to identify semantic changes. Apart from the requested repairs/new tasks and their coverage/source metadata, the already reviewed exercise mathematics was unchanged; all changed mathematical arguments were re-read. Formatting-only differences do not constitute a second independent derivation of unchanged material.

## Five new portfolios: complete independent derivations

The reviewer read **all five complete prompts, all progressive hints, every rubric criterion/level, and all five full private reference solutions**. No prompt relies on the theorem being proved as an allowed black box. Rubrics explicitly accept correct alternative proofs and distinguish an omission from a repairable gap.

1. **MAT-230-u05-ex4, Hahn–Banach:** rederived the extension interval, its finite endpoints and pairwise ordering; checked both signs of the extra scalar and the zero case; checked chain compatibility and the Zorn contradiction without completeness/closedness; recomputed complexification `F=g-i g(i·)`, the imaginary-part agreement and phase rotation; verified norm equality, norming functionals, bidual isometry and the completeness/closed-image equivalence. The proof is valid.
2. **MAT-230-u06-ex4, concrete mid-course assessment:** rederived quotient definiteness and complete series lifting; bounded induced bijection and inverse; controlled approximate lifts without norm attainment; isometric identification of quotient dual with the annihilator; Hahn–Banach distance separation; descended pointwise bounds and the closed-set/Baire/interior-ball operator estimate; incomplete c00 contrast; rational-interval dense open set with measure below 1/20 and nowhere-dense complement above 19/20. Zero-space cases and all named Banach/closedness hypotheses are handled correctly.
3. **MAT-230-u08-ex4, Lp completeness:** rederived summable subsequence differences, finite Minkowski then monotone convergence, almost-everywhere finite sum, measurable limit, tail bound `2^(1-k)` and recovery of the full Cauchy sequence; independently checked the infinity endpoint's single countable null-set exclusion and uniform-Cauchy argument. No finite-measure or sigma-finiteness assumption is needed. No circular appeal to function-space completeness occurs.
4. **MAT-230-u12-ex4, compact self-adjoint spectral theorem:** rederived the quadratic-form/operator-norm equality using real-part polarization with the first-linear convention; extremal residual inequality and compact-image subsequence; invariant-complement iteration; finite multiplicities and eigenvalue decay; equality of the closed eigenvector span with the kernel complement; sharp truncation norm; bounded diagonal resolvent with the kernel denominator; zero's distinct finite/infinite-dimensional behavior; positive Green-factor inverse and its kernel action. The separate regularity bridge is correctly identified rather than inferred by termwise differentiation of an L2 expansion. Finite-rank, zero-operator and zero-dimensional cases are addressed.
5. **MAT-261-u11-ex5, homotopy/Poincare:** rederived the unique time/spatial decomposition, `d_M alpha + dt wedge(partial_t alpha - d_M beta)`, compact-parameter integration, full `dK+Kd` identity and degree-zero case; radial factor `t^(k-1)`; star-shaped primitive; period obstruction on the punctured plane; contraction versus circle retraction; distinct row/column exactness mechanisms in the next unit. Signs and hypotheses are correct.

## Previously remaining geometry solutions: full independent completion

The reviewer now freshly read and independently recomputed all eight original MAT-261 unit 11–12 prompts and full private references that were excluded from the first-pass 74/82 count:

- **u11-ex1:** pullback `r^2 dtheta`, derivative `2r dr wedge dtheta`, matching naturality and circle integral `2pi R^2`; angle does not descend globally.
- **u11-ex2:** closedness and radial primitive `x^2 y+xz`; derivative recovery and constant degree-zero conclusion.
- **u11-ex3:** integer winding pullback `k dt`, period `2pi k`, zero/negative cases, one-dimensional H1 via periodic primitive after subtracting the mean.
- **u11-ex4:** constant radius period from `B_r=A_theta`, explicit covering primitive, angular increment and descent after subtracting the mean angle; full punctured-plane cohomology via a valid smooth circle retraction.
- **u12-ex1:** angle jump `(0,2pi)`, two-component overlap cochains, kernel/cokernel and the acyclic-component qualification for this non-good cover.
- **u12-ex2:** complete partition homotopy index/sign cancellation, support and local finiteness, and why locally constant coefficients are not preserved.
- **u12-ex3:** annulus derivatives and boundary orientations; angular integrals `2pi,-2pi`, polynomial-form integrals `8pi,-2pi`; smooth-domain restriction for the disk.
- **u12-ex4:** tetrahedral hemispheres cover and have contractible proper intersections; ranks 3 and 3 and cohomology R,0,R; total-complex sign and terminating staircase eliminations; local primitive/triple-cocycle construction and independence of choices; outward area integral `4pi`, nonexactness and normalized generator. The general good-cover lemma remains an explicitly imported geometric result. The reviewer also read the full current unit 12 lesson and its four hint/rubric sets.

**Cumulative exact solution coverage is therefore 87/87 current exercises: all 44 MAT-230 and all 43 MAT-261.** This consists of the original 74 derivations plus eight completed geometry derivations plus five new proof portfolios. It is coverage across two independent-review passes, not a claim that every unchanged solution was solved again in the final pass. The lead's separate derivations are additional evidence, not included in this count.

## Additional primary-source checks in this final pass

Freshly consulted the actual cached text of MIT FA Lecture 5 Theorem 48/Lemma 49 (full extension argument), Lecture 13 Theorem 139 (full finite-p summable-series proof, with infinity explicitly left as an exercise in the source), Lecture 22 Theorems 228–232 (Fredholm, extremal eigenvector, maximum principle and full spectral proof), and GM Lecture 32's homotopy discussion, which stops before constructing its K operator. The course portfolios supply complete independently checked arguments beyond the compressed/unfinished source passages; their validity was not inferred from the source title.

Also opened the actual [Hitchin 2014 primary PDF](https://people.maths.ox.ac.uk/hitchin/files/LectureNotes/Differentiable_manifolds/manifolds2014.pdf), and read Theorem 6.7 with its time-component proof, Proposition 6.8/star-shaped qualification, Theorem 7.2 and its coordinate compact-support proof, and Proposition 7.5/Theorem 7.6 with the induced-boundary sign and half-space proof. These support the homotopy and Stokes mechanisms used in the checked geometry capstone. This closes the former blanket “Hitchin not independently inspected” limitation for these specific passages, not for the whole book.

The initial report's remaining source-reading limits still apply to other passages not listed here. This review does not claim a line-by-line reading of every source PDF or every optional reading, nor a new proof of the explicitly imported strong Whitney/global Reeb/general-good-cover results. The teaching materials name those boundaries. No newly reviewed claim requires a stronger certification than the source/proof evidence recorded here.

## Final limits

This is an independent mathematical review with full current exercise-solution coverage and targeted actual-source checks, not human expert certification or evidence of learning effectiveness. All 24 lessons/objectives received the initial academic pass; changed lessons received the final pass described above. The five new full hint/rubric sets and the inherited grading-note scope are explicit; this is not a claim that every old rubric or deterministic evaluator was exhaustively adversarially tested. Application tests, rendering, provider behavior, enrolment and deployment remain the lead's separate validation responsibilities. No model-provider, paid generation or live learner-data call was made by this reviewer, and no quality statuses were promoted.
