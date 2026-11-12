# PHY-210 author review

All ten units are authored as of 12 November 2026. This record covers the physics worker's units01–08; the lead authored09–10. Separate independent source review, solution recomputation and renderer checks remain release requirements. Author checks and structural tests are not expert certification or evidence of measured learning gains.

## Coverage and recomputation

| Unit | Work and author checks |
|---|---|
| 01 | Three retained exercises. Exact spark arithmetic before rounding; time-dilation expansion; half-time speed√3c/2; explicit sample explanation distinguishing proper time along a path from endpoint interval. |
| 02 | Three retained exercises. Coefficient derivation with orientation/continuity assumptions; pole/barn event coordinates and event order; controlled nonrelativistic limit; hyperbolic-group explanation. |
| 03 | Three new problems. Radar offset+0.4µs, corrected speed0.6c; moving-clock offset−72m/c and rate0.8; tidal-tolerance time1.825741858s. |
| 04 | Three new problems. Boosted event(5,−1)m retains norm−24m²; broken trip9years versus13; twin journey6traveller-years versus10Earth-years, turnaround signal reaches Earth at9years. |
| 05 | Three new problems including midpoint synthesis. Causal-cone closure with equality cases; broken-light-path endpoint norm−24m²; hypothetical reply received at76/121t0 with positive Bob-frame reply duration0.648431248t0. |
| 06 | Three new problems. Four Lorentz components; local dimension6via antisymmetricηK; circular proper acceleration9c²/(16R); noncollinear-boost commutator has xyblock(0,1;−1,0). |
| 07 | Three new problems. Detector invariant mass12ε/c²; transverse photon boost preserves null shell; inelastic product mass10m/3 in both frames, total primed energy25mc²/6 and momentum−5mc/2. |
| 08 | Four new problems. Pair threshold2mc²(1+m/M); daughter energies11mc²/5 and14mc²/5 with p=4√6mc/5; Compton recoil shell checked; hypothetical mass deficit gives Q=3.59502071494727e−12J,22.4383544MeV and719.004143W before efficiency. |

All new problems have progressive hints, explicit rubric criteria accepting correct alternative approaches, and private reference reasoning. No reference answer is copied into the learner lesson. Unit05's midpoint assessment requires two event tables, diagrams in both frames and explicit signalling assumptions. Original exercise IDs remain stable. Early explanation tasks have complete sample answers as well as grading guidance.

## Source map and limits

The primary spine is Taylor and Wheeler, *Spacetime Physics*, 2nd ed.1992, released under CC BY4.0 on the [authors' download page](https://www.eftaylor.com/spacetimephysics/). New prose, numerical examples and exercises are original. Actual chapter text was consulted, not merely section titles. Extracted OCR has artefacts; ambiguous printed symbols still warrant page-image checking in the independent source pass.

| Units | Sections consulted |
|---|---|
| 01–02 | Existing verified chapter1, chapter3 and Special Topic locators retained. This worker rechecked mathematics and assumptions; it does not claim a fresh full page-image audit of the original chapters. |
| 03 | Chapter2 §§2.2–2.3,2.5–2.9: inertial tests, locality, test particles, clock lattice, observer and velocity. |
| 04 | Chapter4 §§4.6–4.9 and chapter5 §§5.2–5.8: twin frames, diagrams, invariant hyperbola and proper-time integration. |
| 05 | Chapter6 §§6.1–6.3, printed171–181: causal classification and light cones. |
| 06 | Chapter7 §7.2, printed191–195; Tong§§7.3.2,7.4: four-vectors, group and index notation. |
| 07 | Chapter7 §§7.2–7.6, printed191–210; chapter8 §§8.1–8.4: conservation and system mass. |
| 08 | Chapter8 §§8.3–8.7, printed224–243; Tong§7.5: photons, recoil, thresholds, decay and mass deficits. |

Tong's [Dynamics and Relativity chapter7](https://davidtong.org/pdfs/teaching/dynamics-and-relativity/dynrel7.pdf) remains reference-only supplementary reading, not copied into lessons or imported into the application library. Its metric has the opposite overall sign. The course explicitly uses(−,+,+,+), and distinguishes positive energy-squared collision invariant s from spacetime intervalΔs².

## Corrections and academic boundaries

- **Rounding and nullness:** original unit01 ex1 called10.0m exactly null at33.36ns using exact c, but cΔt=10.00107639888m. The revised null case specifies Δx=cΔt exactly. The reference distinguishes exact nullness from measurement compatibility and retains precision before classification.
- **Path dependence:** the endpoint square-root formula gives proper time along the straight inertial route. An accelerated clock requires the path integral; merely being present at both events is insufficient.
- **Boost hypotheses:** linearity and interval preservation also allow spatial/time reversals. Unit02 now states orientation, future-directed clocks and continuity to identity. Homogeneity and continuity are explicit coordinate assumptions; the quadratic-polynomial extension from timelike displacements is explained.
- **Nonrelativistic scaling:** small boost speed alone does not control clock offsets at arbitrarily large separations. The controlled limit fixes coordinates and velocities as c grows; signed subluminal bounds use absolute values.
- **Neutrinos:** the1992 book's light-speed examples on chapter5 p153, chapter6 p176 and chapter8's particle box are outdated. Oscillation evidence establishes nonzero mass differences; neutrinos cannot all be treated as massless. See the [official Nobel2015 release](https://www.nobelprize.org/prizes/physics/2015/press-release/) and [Royal Swedish Academy announcement](https://www.kva.se/en/news/nobelpriset-i-fysik-2015-2/). Lessons use photons as null examples and do not assert that every mass eigenvalue is known to be nonzero.
- **Higgs decay:** Tong§7.5.1 p146 incorrectly says the Higgs mostly decays into two photons. [CERN](https://home.web.cern.ch/science/physics/higgs-boson/ten-years/) identifies bottom-quark pairs as dominant; [CMS](https://cms.cern/news/two-photons-illuminate-path-towards-higgs-bosons-hidden-partner) describes the diphoton channel as roughly two in a thousand. General two-photon kinematics remains valid; conservation does not predict branching fractions.
- **Hypothetical causality protocol:** the unit05 loop requires controllable two-way superluminal signals with symmetric sender-frame rules and immediate replies. A spacelike correlation or phase velocity alone supplies no such device.
- **Kinematics versus dynamics:** thresholds do not establish other quantum-number conservation, reaction probability, angular distributions or lifetimes. Supplied numerical reaction data are explicitly hypothetical. Massless final thresholds may be limiting infima, not all-rest configurations.
- **No photon rest frame:** null four-momentum is not obtained by setting m=0 in a finite massive-particle U. A spacelike acceleration vector does not make the worldline tangent spacelike.

## Validation

`pnpm content:validate` passed with0errors and0warnings. Targeted `pnpm exec vitest run --project content packages/content/src/first-courses.test.ts -t PHY-210` passed: all10units ready, each has at least3reachable exercises, private reference solutions and an existing exit checkpoint. These verify availability and integrity; independent academic review, production rendering and release remain lead-owned. No runtime model/subscription generation, production mutation, commit or deployment occurred in this author milestone.

Final independent review completed 2026-11-12; pending author-era statements above are superseded by PHYSICS_REVIEW.md and the lead ledger. All current reference solutions have an independent reasoning pass. Workload and learning effectiveness are not empirically validated.
