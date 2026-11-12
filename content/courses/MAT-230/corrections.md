# Corrections and boundaries

These are course author findings, not an official erratum issued by the source authors. Each course note either derives the repaired claim or states the imported-result boundary.

## MAT-230 u01 existing misconception

A height-one spike somewhere for each n only excludes uniform convergence. The replacement uses a fixed centre and alternating zero terms, so integral norm tends to zero while values at that fixed point fail to converge.

## MIT 18.102 Lecture5, complex Hahn–Banach extension

The course writes the real extension and complexification F(x)=g(x)−ig(ix) explicitly, then uses a phase rotation to recover the sharp norm. This is a clarification of a compressed source proof, not a claim that the theorem is false.

## MIT 18.102 Lecture23, Theorem235, printed page120

The displayed source kernel (x−1)y / (y−1)x has the wrong sign for the inverse of −u''. The course uses min(x,y)(1−max(x,y)); direct differentiation gives −(Gf)''=f, and f=1 gives x(1−x)/2. Source page rendered and inspected.

## Lead independent review: units07,08,12

Nonnegativity is explicit in MCT; Minkowski treats p=1 separately and first establishes finiteness using the elementary convexity bound; the variable-potential classical solution explicitly assumes f continuous.

## Authoring/render repair

One non-raw Python string introduced BEL and lost the second derivative in the resonance prompt. Repaired to −u''−alpha u=f. Parsed-content control-character scan and strict KaTeX render scan rerun; these are formatting checks, not correctness proofs.

## Independent review R02–R07: further source and assessment repairs

- Lecture13 Corollary137: decay must be an upper bound, not a lower bound. Unit08 now annotates the assigned reading and gives the constant-function counterexample and explicit integrability bound.
- Lecture20 Proposition213: the invertibility factor is I+T0⁻¹(T−T0), not the printed minus factor. Unit11's assigned-reading annotation supplies the sign and order.
- Lecture23 Theorem241 proof: multiplication by V need not be compact (V=1 is the identity). Unit12 points to compact Green square-root factors and bounded multiplication.
- Lecture1 header identifies lecturer Casey Rodriguez and notes by Andrew Lin. The unverified “following Melrose” attribution was removed from course/instructor prose.
- Unit03's private grading now accepts partial-sum functionals on c00: each fixed input gives an eventually constant output sequence but operator norm is n.
- Unit03 now proves closed-subspace quotient completeness using lifts and the already taught absolutely summable series criterion.
- Unit12's resonance task declares f∈L², the spectral operator domain, and the optional continuous-forcing classical strengthening.

Proof-assessment additions address the retained outcomes: real/complex Hahn–Banach, Lp completeness including infinity, compact self-adjoint spectral theorem, and an actual mid-course synthesis after unit06. Author repair is not independent re-approval; the parent review must check these additions.
