# Lead academic review

## CHE-101 u06 — independent recomputation, 2026-11-12
Read the full lesson and all four prompts/reference solutions. Re-derived weak-acid mass/charge balance, spectator-ion contribution, buffer exhaustion, strong-acid water correction and all four titration regimes. Independently computed quadratic roots and solved the full charge-balance residual by bisection in log concentration; rounded reference values and stated approximation limits agree. No correctness finding. Source-anchor review waits for precise MIT locator merge; visual rendering review separate. No live model used.

## MAT-230 units 05–08 — independent derivation review
Read all four full lessons and twelve problem/reference pairs. Re-derived Hahn–Banach extension interval and complex phase rotation; subspace separator and c0 dual example; outer-measure/Carathéodory sigma closure and Borel–Cantelli counterexamples; monotone convergence and Fatou repair; Lp spike taxonomy and typewriter sequence. Answers and hypotheses agree. Requested two clarity repairs: state nonnegativity in MCT explicitly; handle p=1 and establish integrability before the Holder proof of Minkowski. Source-fidelity and renderer checks still separate.

## Additional independent reasoning pass — 2026-11-12
MAT-23009–12: all four lessons and12 full reference solutions read. Recomputed projection residual1/180, Fourier sumπ²/6, constraint minimum√3, shift adjoint/ranges, dense proper diagonal range, Neumann perturbation bounds, diagonal spectra, strong/norm distinction, positive Green kernel, spectral truncation sharp bound, resonance compatibility and G^1/2 uniform-convergence/classical-regularity bridge. Asked author to make continuous-f hypothesis explicit in final potential section. No other substantive defect found.

CHE-10107–10: all four lessons and16 exercises/reference solutions read. Independently balanced Mn/S redox atoms and charge, derived concentration-cell polarity and reaction-scaling invariance, checked d counts/orbital occupancies/spin energies, derived enzyme quasi-steady and two-state kinetics, reconstructed solubility/speciation and capstone. Requested explicit dimensionless-Ka/standard-state correction and capstone R datum. Independent numerical recomputation follows (rounding consistent except minor last-digit differences):
```json
{
  "CHE07ex2_E": 1.064515835415569,
  "CHE07ex2_dG_kJ": -205.41962076014238,
  "CHE07ex2_logK": 37.2890018716406,
  "CHE07ex3_E": 0.059159534695878487,
  "CHE07ex4_mass": 0.5690391667098514,
  "CHE08_gap640_kJ": 186.91650881046405,
  "CHE09_Ea": 42117.06005626767,
  "CHE09_k302": 0.030027554918891027,
  "CHE09_k340": 0.19573703603586606,
  "CHE09_B20": [
    0.04130032769120838,
    0.07362632708334493
  ],
  "CHE10_s": 0.001004987562112089,
  "CHE10_capstone_Ered": -0.2591595346958785,
  "CHE10_capstone_dG_kJ": 69.30701541026367,
  "CHE10_capstone_moles": 0.007462299839353267,
  "CHE10_capstone_energy_permol": 361818.75
}
```
Source-by-source factual final review and renderer checks are separate; this pass is not empirical learning validation.

## Geometry and first deep-learning checks
MAT-26103–09: all seven notes and23 original problem/reference solutions reviewed. Re-derived inverse/implicit normal forms, orthogonal-group derivative, cylindrical flow, tangent-chart Jacobians, Möbius pullback and stable sphere triviality, partition connection and Grassmannian bundle map, compact embedding, Sard rank/Taylor dimensions, Schur-complement strata, secant/tangent projections, Fredholm parametrix/index and cubic family, transverse-slice equivalence/index and finite double-pair argument. No substantive mathematical error found; source proof limitations stated explicitly.
CSA-21003–04: all notes and8problem/reference solutions reviewed; re-derived spline errors/XOR obstruction, stable softmax gradient, full ReLU backprop, factor gradients/rank obstruction, balanced logistic mode and Gram/cosine invariance limits. Asked for complete runnable private reference implementations where prompts explicitly require code (03ex4/04ex4), rather than algorithm description alone. Numerical execution follows after implementation.

## Completed independent reasoning and executable pass — 2026-11-12

CHE-101 units 01–10: read all ten lessons and all 37 complete prompt/reference pairs. Independently re-derived stoichiometric yield bounds, atomic energies/photoelectric/PES assumptions, formal charge and molecular polarity, thermodynamic state/standard-state/entropy/K relations, ICE quadratics and reversible ODE boundaries, and all later acid-base/redox/coordination/catalytic/capstone results recorded above. Earlier inherited lesson, hint, fixture and rubric defects were repaired; the fresh science reviewer reread those repairs separately. This is an independent answer pass, not merely reuse of author calculations.

CSA-210 units 01–10: read all ten lessons and all 38 complete prompt/reference pairs. Re-derived evaluation information boundaries and selection bias, smooth-gradient bounds and finite differences, backpropagation, deep-linear modes, optimisers, uncertainty/covariance, regularisation/dropout, convolution gradients, attention masking/permutation, PCA/ELBO/contrastive objectives, and the full capstone's split/selection/evaluation protocol. All 14 Python fences executed independently with zero failures. ReLU gradient maximum discrepancy 2.10e-9; convolution 4.40e-10; capstone finite differences 1.504459e-10. Independently read the complete standalone CPU reference implementation and reproduced its JSON output exactly (SHA-256 9023f48f18701fa2da2d5516e18071438b2d1379b90e537d3919105f2d6338fd). Three selected-model held-out accuracies: .85625, .76875, .7875; these are synthetic benchmark results, not claims about real-world or learner performance. Executable evidence was held outside the repository during checking; the original reference/results are in CSA-210/labs.

MAT-261 units 10–12: full lessons and all twelve original prompt/reference pairs re-derived, including Frobenius obstruction, flow-box dependencies, exterior derivative/periods, sphere de Rham groups, good-cover Čech ranks and the two double-complex homotopies. No substantive mathematical finding. The independent maths reviewer separately covers all 87 current maths solutions.

All five newly added full-proof portfolios were independently read and reconstructed by the lead: MAT-230 u05-ex4 real/complex Hahn–Banach and the canonical embedding; u06-ex4 quotient completeness, bounded inverse, annihilator isometry, Baire and category/measure distinction; u08-ex4 Lp completeness including p=infinity and a common null set; u12-ex4 the compact self-adjoint spectral construction, resolvent/zero cases and continuous-data Dirichlet bridge; MAT-261 u11-ex5 the time/spatial form decomposition, homotopy identity with the correct sign, degree zero, radial Poincaré and the punctured-plane obstruction. No unresolved proof error found. The final fresh maths review independently confirms these and all requested source/activity/timing repairs.

Separate final-review ledgers: MATHS_REVIEW.md (87 solutions), PHYSICS_REVIEW.md (33 solutions and 32 numerical checks), SCIENCE_REVIEW.md (20 lessons, source/hypothesis checks and nine repaired consistency findings). Together with this lead's 75 chemistry/CS solutions, every one of the selected 195 solutions has an independent reasoning pass. Actual source-review scope is recorded in those ledgers and the manifests; linked-only videos/textbooks were not silently treated as read. These are AI-assisted reviews, not human expert certification or empirical evidence of learning effectiveness. Workload estimates remain provisional.
