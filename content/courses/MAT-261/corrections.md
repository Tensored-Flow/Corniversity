# Corrections and boundaries

These are course author findings, not an official erratum issued by the source authors. Each course note either derives the repaired claim or states the imported-result boundary.

## MIT 18.965 Lecture5, ODE discussion

The source ODE discussion is unfinished. Unit03 supplies a full local Picard contraction argument and distinguishes local solutions from complete flows.

## MIT 18.965 Lectures10–11, Lemma12.2

A continuous image of an arbitrary Lebesgue-measurable set need not be Lebesgue measurable. Our Sard proof works on sigma-compact critical-image pieces and uses compact-image measurability, rather than the overbroad lemma.

## MIT 18.965 Lecture12, Lemma13.3 and rank proof

For rank-r n×k matrices, kernel dimension is k−r, not r; the Schur-complement kernel equation acts on the second block variable. Unit06 gives the block elimination and codimension (n−r)(k−r) correctly.

## MIT 18.965 Lecture13, Stiefel-to-Grassmann bundle example

With nonorthonormal frames the fibre over a fixed k-plane is GL(k), of dimension k². The source gives a mismatched space of injections; unit07 supplies graph-chart coordinates j=(I+A)C and their inverse.

## MIT 18.965 Lecture14, tangent-direction Sard argument

The image of the tangent-direction map has measure zero by the strict dimension inequality; the source sentence says full measure. Unit07 uses zero measure for both bad sets and retains the strict inequalities.

## MIT 18.965 Lectures15–17, analytical hypotheses

B(X,Y) is Banach if Y is Banach and is an algebra under composition when X=Y. The operator theorems retain Banach hypotheses. Finite-rank approximation of every compact operator is not asserted for arbitrary Banach spaces. Neumann series includes its identity term.

## MIT 18.965 Lectures16–17, Theorem16.26 converse

The parametrix implication gives finite-dimensional cokernel, not finite-dimensional range as accidentally printed. Unit08 proves finite kernel, a complement lower bound/closed range, and finite adjoint kernel/cokernel.

## MIT 18.965 Lectures18–19, Theorem17.3

The statement must require a smooth Fredholm map. The course restores this, second countability and the Baire setting, and distinguishes residual from a measure claim. Source page42 rendered and inspected. Local-closedness uses a bounded finite-dimensional kernel-coordinate factor.

## MIT 18.965 Lecture20, finite-dimensional inverse-image sequence

The map L⁻¹(V)→V has image ran(L)∩V, not necessarily all of V. Unit09 uses that intersection, gives the cokernel quotient and derives index(dπ)=index(L)+dim V. It states split and differentiability hypotheses explicitly.

## MIT 18.965 Lectures21–22, strong Whitney scope

The n=0 case needs a separate statement: a finite set with multiple points cannot embed in R⁰. The source is a proof sketch, beginning in n>2 and using framing/sign and Whitney-disk input. The course preserves the strong theorem for n≥1 but does not claim to prove all low-dimensional surgery cases. Double-point finiteness explicitly excludes accumulation at the deleted diagonal.

## MIT 18.965 Lecture32, homotopy operator

The source stops before constructing K. Unit11 supplies the dt decomposition, sign, integral homotopy identity and radial primitive; degree0 is treated separately.

## MIT 18.965 Lecture32, Čech sign convention

The displayed source degree0 map uses the opposite sign to the stated alternating differential. Unit12 consistently uses (δc)ij=cj−ci and D=δ+(−1)^p d.

## Existing MAT261u02 injective-immersion explanation

The figure-eight example is injective only with the stated open-interval parametrization beta(t)=(sin2t,sint), −pi<t<pi. The misconception record now repeats the domain and distinguishes the usual closed-circle parametrization.

## Independent review R01/R07: derivative ratio and zero dimension

MIT Lecture 3, Definition 4.1 has an insufficient explanation of little-o. The remainder divided by the increment norm must tend to zero; continuity and zero value alone do not suffice. Unit02 now states the ratio and the |t| counterexample explicitly. The sphere chart task specifies n≥1 and the private reference treats S⁰ separately by cardinality.

## Independent review R04: assess the homotopy proof

Unit11 exercise5 now requires the full time/spatial decomposition, dK+Kd identity with signs, degree-zero case, star-shaped primitive, global obstruction and double-complex role. A worked use of the formula is not counted as proof evidence. The new private reference remains pending separate post-repair review.
