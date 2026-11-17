# PHY-210 independent academic and source review

Reviewer: independent physics review agent, 2026-11-12. Reviewed the working tree on `codex/university-teaching-quality`, based on `1216ffa34f71378a1a8d9b05f738a190e298ec98`, at `/home/leon/work/Corniversity`. This reviewer did not author or edit teaching content. Only this review record is owned by the reviewer. Changes made after the reviewed snapshot require a targeted follow-up.

## Latest disposition

**PASS after targeted repair for the reviewed academic content and calculations.** Fresh server-file inspection confirmed repairs R1–R4 on 2026-11-12. No open P1/P2 academic finding remains. R5 has a minor remaining record caveat described in the follow-up below. Scope and limitations of the source and learner-experience review remain unchanged.

## Initial decision (historical, before repair)

**Repair required before recording independent academic review as complete.** All ten lessons and all 33 problem/private-reference pairs were read and independently worked through. No incorrect final numerical answer was found. Three substantive wording issues remain: the domain of the general fixed-target threshold formula, an unspecified scattering orientation, and an inherited rubric/hint that still treats proper time as determined solely by endpoints. Two smaller metadata qualifications and stale shared-source verification records should be reconciled at the same time.

This review establishes mathematical/content review coverage, not accreditation, expert faculty certification, empirical teaching effectiveness, or a claim that this is the best available university course. Runtime tutor behaviour, access control, learner-state mutation, browser rendering and deployment are outside this review.

## Findings

### PHY-R1 — P2: constrain the general threshold formula

File: `content/courses/PHY-210/units/08-collisions-decays-and-invariant-mass/lesson.md`, lines 15–19.

The displayed projectile energy threshold is stated for final massive particles without requiring an endothermic production channel. For an exothermic channel, the algebraic equality with the sum of final rest masses can require a projectile energy below its own rest energy. For example, in units c=1, ma=mb=1 and final total rest mass Mf=1 give Ea=-1/2, although a massive projectile has Ea>=1. In such a channel the actual products already have relative kinetic energy at the zero incident kinetic-energy limit. A one-particle final state also fixes the incoming invariant rather than generally opening a channel at every energy above it.

Repair: explicitly scope the formula to endothermic multiparticle production with Mf>=ma+mb and mb>0; explain the nonnegative kinetic-energy lower bound for otherwise allowed exothermic channels and distinguish a one-particle resonance. The three-mass example and photon pair-production exercise are correct within their stated regimes.

### PHY-R2 — P2: specify the sign of the Compton scattering angle

Files: `content/courses/PHY-210/units/08-collisions-decays-and-invariant-mass/exercises/PHY-210-u08-ex3.json`, line 6; its private reference, line 3.

The outgoing photon is 60 degrees from +x in the xy plane, which permits positive or negative y. The reference takes positive y and gives a negative-y electron recoil. Both mirrored solutions satisfy the prompt.

Repair: specify 60 degrees counterclockwise from +x, or explicitly choose positive y without loss of generality and accept the mirrored momentum/direction. The energy, speed, magnitude and invariant are correct. As a completeness improvement, include the two-line mass-shell derivation in the private reference rather than only invoking the Compton formula, since the prompt asks for a derivation.

### PHY-R3 — P2: propagate the path-dependent definition of proper time into assessment metadata

Files: `content/courses/PHY-210/units/01-events-the-interval-and-proper-time/exercises/PHY-210-u01-ex3.json`, lines 9 and 16; `content/courses/PHY-210/course.json`, line 12 and outcome o1.

The lesson and private explanation correctly distinguish an inertial endpoint formula from elapsed time along an arbitrary worldline. The inherited rubric still says that one clock present at both events reads sqrt(-Delta s^2)/c, without requiring that clock to follow the straight inertial connecting path. Its first hint also attaches proper time to an event pair alone. This can misgrade the correct path-dependent explanation. A clock travelling (t,x)=(0,0)->(5,4)->(10,0), in c=1 units, records 6; the endpoint interval is 10.

Repair: specify the clock's worldline; restrict the endpoint formula to the straight inertial connection; state the path integral for general motion. Align course description, outcome and hint/rubric with the already correct lesson and reference. Keep frame invariance of a specified path distinct from path independence.

### PHY-R4 — P3: two remaining metadata qualifications

`course.json`, lines 12 and 26: the Lorentz group consists of linear Minkowski isometries fixing the origin. The full affine isometry group includes translations and is the Poincare group, as unit 6 already explains. Qualify the course description/outcome accordingly.

`units/02-principle-of-relativity-and-the-lorentz-transformation/exercises/PHY-210-u02-ex1.json`, line 118: the rubric still describes the Galilean limit using only v<<c. Align it with the repaired prompt/reference: fixed coordinate scales for the c->infinity limit, or suitable spatial/time scales and both relevant velocities in an approximate low-speed limit. The lesson/reference already make the stronger qualification.

### PHY-R5 — P3: shared source verification records are stale

`content/sources/taylor-wheeler-spacetime-physics.json`, chapter-location notes around lines 80–86 and the version limitations, still say chapters 2,4,5,6,7,8,9 were listed but not opened. The current author record and actual chapter caches now contain direct reading evidence. Preserve the historical verification date where useful, but append the current verified reading coverage rather than presenting the old status as current. This reviewer independently read selected substantive passages listed below; it would be inaccurate to claim a full line-by-line reread of every source chapter.

## Complete problem review ledger

Every exercise prompt, hint ladder, rubric, deterministic-check declaration/example where present, and private reference was read. The inherited grading/lesson notes in units 1–2 were also read. All 33 problems were independently reasoned through, including qualitative assumptions; the table records representative decisive results, not just author-supplied check assertions.

| Unit | Exercises | Independent checks and conclusions |
|---|---:|---|
| 01 | 3 | Exact cDelta t=10.00107639888 m; interval=-64.0215291362 m^2; c tau=8.001345458 m. Spacelike variant has distance 6.631626562 m and simultaneous-frame speed 0.833423033c. Null classification must precede rounding. Low-speed fractional clock corrections and v=sqrt(3)c/2 checked. See R3 for the inherited definition. |
| 02 | 3 | Boost coefficients, time/spatial orientation assumptions, rapidity composition and velocity addition derived. Pole/barn lengths 8 m and 6.4 m; closing events transform to (ct',x')=(-6,10),(0,0) m with invariant 64 m^2. Galilean scaling qualification checked; see R4. |
| 03 | 3 | Radar midpoint 5 microseconds and 0.4 microsecond clock offset; corrected speed 0.6c, uncorrected 5c/9. Moving 120 m clock lattice contracts to 96 m; simultaneity offset -72m/c and rate 0.8. Tidal observation-time bound sqrt(10/3) s. |
| 04 | 3 | Boosted axes are Minkowski-normalised/orthogonal; (7,5) transforms to (5,-1), invariant -24. Broken worldline proper time 9 versus straight 13. Twin ages 6 versus 10; assigned Earth times 1.8 and 8.2, jump 6.4; turnaround signal arrives at Earth time 9; Doppler factors 1/3 and 3. Assignment of simultaneity is separated from reception of light. |
| 05 | 3 | Future-causal cone closure proved by the Euclidean triangle inequality and equality conditions. Two non-collinear null legs have a timelike total displacement. FTL protocol rederived from event displacements: tB=20t0/11, xB=18ct0/11, tC=76t0/121; Bob's reply-time difference is gamma*(171/605)t0>0. The controllable two-way device and absence of a preferred chronology are explicit assumptions. |
| 06 | 3 | Lorentz component signs and rank-10 constraint derivative checked. Circular motion gamma=5/4 gives proper acceleration 9c^2/(16R) and U.A=0. Boost commutator has the stated xy antisymmetric block at order ab; finite products are not falsely declared pure rotations. |
| 07 | 3 | Energy 13epsilon and momentum (3,4)epsilon/c give mass 12epsilon/c^2, velocity (3,4)c/13. Transverse photon boost gives (5/4,-3/4,1,0)E/c and remains null. Inelastic head-on merger mass 10m/3; boosted total energy 25mc^2/6 and momentum -5mc/2 preserve that mass. |
| 08 | 4 | Photon-target pair threshold 2mc^2(1+m/M); equal target mass yields 4mc^2. Parent 5m into m and 2m gives energies 11mc^2/5,14mc^2/5 and momentum 4sqrt(6)mc/5. Compton recoil mass shell equals 1; energy 4mc^2/3, speed sqrt(7)c/4; orientation caveat R2. Mass deficit 4e-29 kg gives 22.4383544 MeV, 719.004143 W and 179.751036 W useful at stated rate/efficiency. See R1. |
| 09 | 4 | Constant laboratory braking: ts=3mc/(4F), distance mc^2/(4F), proper time (mc/F)ln2, proper acceleration F/m. Four legs with r=ln2 yield Earth time 3c/a, traveller time 4(c/a)ln2, xmax=c^2/(2a), vmax=0.6c. Smooth rapidity profile reunites by odd-half-period symmetry, endpoint rest holds, and strict clock inequality follows from cosh>=1. Variable-mass product rule gives K.U=-c^2 dm/dtau; isotropic influx can increase rest energy without acceleration. |
| 10 | 4 | Newtonian tidal matrix has radial eigenvalue +2GM/r^3 and transverse -GM/r^3; specified displacements -108 and +216 micrometres and tolerance durations checked. Rindler metric cross terms cancel; proper clock ratio 1+ah/c^2, photon frequency ratio its reciprocal, acceleration a/(1+a xi/c^2), with positive lapse domain. Local beam sag -gL^2/(2c^2) has explicit small-lift regime and is not a global stellar-deflection prediction. Final interval -16L^2, proper time 4L/c, photon system mass 2sqrt(2)E/c^2 and COM speed -c/3; both COM photon energies sqrt(2)E. |

A separate local Python arithmetic audit passed 32 numeric/invariant assertions spanning all ten units, including a 20,000-point quadrature of the smooth rapidity trajectory. The initial audit script had a mistyped coefficient in its own causal-loop check; direct event-equation rederivation corrected that script, after which all checks passed. This was a reviewer-script error, not a course error. Numerical tests supplement the analytic reasoning and do not prove general claims.

## Direct primary-source coverage

Actual text was inspected, not just link titles, source catalogues or the authors' review claims. The chapter caches were copied read-only from `/tmp/corniversity-source-review-science/` on the server. Public primary-source pages were opened for source access and current corrections.

- Taylor and Wheeler, [author download page](https://www.eftaylor.com/spacetimephysics/): second edition and author CC BY 4.0 distribution verified. [Chapter 1](https://www.eftaylor.com/spacetimephysics/01_chapter1.pdf), section 1.2, printed pp.5–7: actual interval and light-travel-unit treatment read; sign translation checked against course convention.
- [Lorentz special topic](https://www.eftaylor.com/spacetimephysics/04a_special_topic.pdf), L.3–L.5, printed pp.99–102: linearity, interval-based coefficient derivation, boost direction and inverse convention checked. Chapter 3's large PDF did not load through the web reader; this review does not claim that chapter was independently reread.
- [Chapter 2](https://www.eftaylor.com/spacetimephysics/02_chapter2.pdf): selected actual sections 2.2–2.3 and 2.5–2.7 on local free-float tests, test particles, clock lattices and recording versus visual reception. [Chapter 4](https://www.eftaylor.com/spacetimephysics/04_chapter4.pdf), 4.6–4.9, printed pp.125–129: twin asymmetry, length contraction and switching simultaneity frames. [Chapter 5](https://www.eftaylor.com/spacetimephysics/05_chapter5.pdf), 5.6, printed pp.148–152: cumulative proper time along a worldline and straight-path maximal ageing.
- [Chapter 6](https://www.eftaylor.com/spacetimephysics/06_chapter6.pdf), opening 6.2, printed pp.172–174: invariant causal classification. [Chapter 7](https://www.eftaylor.com/spacetimephysics/07_chapter7.pdf), selected 7.3–7.6, printed pp.195–202 and opening p.207: four-momentum, invariant mass, Newtonian limit, total versus kinetic energy and isolated-system conservation.
- [Chapter 8](https://www.eftaylor.com/spacetimephysics/08_chapter8.pdf), selected 8.4–8.6, printed pp.231–236: photon/electron recoil, pair-creation recoil and massive fixed-target threshold. [Chapter 9](https://www.eftaylor.com/spacetimephysics/09_chapter9.pdf), 9.4–9.6, printed pp.280–285: relative acceleration as a tidal diagnostic and the local/global distinction.
- David Tong, [Dynamics and Relativity chapter 7](https://davidtong.org/pdfs/teaching/dynamics-and-relativity/dynrel7.pdf), 7.4.5–7.4.6, printed pp.140–143: four-force, constant-rest-mass work equation, orthogonality, proper versus coordinate acceleration, hyperbolic motion and proper-time integral. The course uses the opposite metric sign consistently. The original Rindler, circular-motion and variable-mass tasks were independently derived rather than attributed wholesale to this reading.
- The old Taylor neutrino example is indeed outdated. The [Royal Swedish Academy's 2015 Nobel announcement](https://www.kva.se/en/news/nobelpriset-i-fysik-2015-2/) directly supports the oscillation/mass correction. This does not assert that every mass eigenstate must individually have positive mass. Course use of photons for physical null examples is appropriate.
- Tong's printed p.146 actually contains the incorrect claim that Higgs decay is mostly diphotons. The [CERN ten-year Higgs overview](https://home.web.cern.ch/science/physics/higgs-boson/ten-years/) states the dominant bottom-pair mode; [CMS's 2026 diphoton discussion](https://cms.cern/news/two-photons-illuminate-path-towards-higgs-bosons-hidden-partner) states the diphoton mode occurs at about two per thousand. The course correctly separates decay kinematics from branching predictions.

MIT videos were not watched in full; all source exercises, historical numerical statements and bibliographic rights outside the specific inspected pages were not audited. The foundational mathematics above was independently checked even where a full supplementary source was not read. Source-review claims must retain these boundaries.

## Learning progression assessment

The ten-unit sequence is coherent: invariant measurements, transformations, operational clocks, worldlines, causal synthesis, group/four-vector structure, momentum, collisions, accelerated motion, then model limits. The two synthesis tasks require transfer, not merely a substituted number. Hints generally progress from identifying a useful invariant to calculation and interpretation. The notes are compact; the claimed 60–120 hour workload relies on the prescribed external reading and substantial written solutions. Those workload estimates and the difficulty progression remain untested with learners. This is a complete compact study path within its advertised SR scope, not evidence of equivalent laboratory, cohort, faculty or accreditation experiences.

## Follow-up status

Fresh post-repair inspection completed on 2026-11-12 by the same independent reviewer:

- R1 resolved: the threshold expression is now explicitly scoped to endothermic production with at least two final particles and Mf>=ma+mb. The allowed example and photon-target calculation remain correct; the counterexample no longer lies within the claimed domain. A stationary target already entails a massive target. Additional discussion of exothermic and one-particle cases would be enrichment, not required to make this bounded formula correct.
- R2 resolved: the prompt now specifies counterclockwise toward +y, agreeing with the negative-y electron recoil in the private reference. The optional suggestion to repeat the Compton derivation in that reference is nonblocking because the lesson and hint ladder provide the derivation and the rubric requires it.
- R3 resolved: the course description now gives both the inertial endpoint formula and general path integral; outcome o1 names specified paths. The exercise hint and version-2 rubric explicitly require the clock worldline and restrict the endpoint formula to straight inertial motion.
- R4 resolved: both Lorentz-group metadata locations now specify linear maps fixing the origin. The unit 2 version-2 rubric matches the fixed-scale and two-low-speed limit qualifications of the prompt/reference.
- R5 substantially resolved at source-version level: actual chapter reading scope and the neutrino correction are recorded, and Tong's known Higgs error is recorded. Individual Taylor chapter 2/4–9 location notes retain the old dated 'file not opened' wording. The lead was asked to label it explicitly as historical or append the current read update. This is a P3 documentation consistency caveat, not an unresolved physics calculation or academic blocker.

The post-repair check inspected the actual current files over SSH, not just the lead's summary. No teaching files were edited by this reviewer. The overall application, import/enrolment result and runtime behaviour still require the lead's separate verification.


Final reviewed academic snapshot: 2026-11-12T04:56:30.229515+00:00; 81 course/lesson/exercise/instructor files; aggregate relative-path-and-content SHA-256 2208d8207ef2e9f5f2a7deadf478af92c6b244a6a5b6ddc1d4047f8b759719ad. Review-status metadata changes later do not imply a fresh full academic review.
