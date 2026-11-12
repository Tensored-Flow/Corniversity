# Mathematics authoring and repair ledger

2026-11-12. Both promised twelve-unit courses are fully authored. MAT-230 version3 has44 exercises; MAT-261 version4 has43. No runtime generation/API call, production mutation, commit or deployment was made by this author.

## Review and repair status

Independent pre-repair findings are preserved unchanged in MATHS_REVIEW.md. R01–R07 have author repairs in the teaching files, but this ledger does not close them as independently passed. The parent must review the new proof portfolios and every changed statement after repair. The earlier independent report records74 of82 old solution recomputations; the lead separately reported the remaining geometry units11–12. These are distinct scopes, not a claim of a single exhaustive source pass.

New proof tasks: MAT-230-u05-ex4 (real/complex Hahn–Banach), MAT-230-u06-ex4 (actual mid-course assessment), MAT-230-u08-ex4 (all Lp completeness), MAT-230-u12-ex4 (full compact self-adjoint spectral theorem plus Green-operator connection), MAT-261-u11-ex5 (homotopy identity/Poincaré). Full private solutions are exported below. The existing advanced strong-Whitney/Reeb and general good-cover proof boundaries remain explicit; they were not weakened or silently recast as proved elementary results.

Other repairs: correct little-o ratio; accept the valid partial-sum functional counterexample; teach quotient completeness; annotate three additional source errors; declare resonance forcing and operator domain; precise Casey Rodriguez/Andrew Lin attribution; n≥1 sphere argument with separate S⁰ case. Prose/formula spacing was repaired without changing math tokens. The correction/source maps preserve exact locator IDs.

## Validation

Final author-repair validation: content validation passed with zero errors and zero warnings; strict KaTeX scan rendered 8,118 expressions without errors across the selected-course data. Parsed-content control-character, instructor-reference and activity-reachability audits found zero issues in both mathematics courses. These are structural/render checks, not academic proof certification. No empirical teaching-effectiveness or human expert certification is claimed.

## MAT-230

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

### MAT-230-u01 — Normed and Banach spaces

Objectives: State the norm axioms and verify them for the sup norm on C_∞(X).; Explain why convergence in the sup norm is uniform convergence and why C_∞(X) is complete.; Show by explicit computation that the sup norm and the integral norm on C([0,1]) are not equivalent, and name the finite-dimensional hypothesis that fails.; Produce a Cauchy sequence in (C([0,1]), ‖·‖₁) with no continuous limit.

#### MAT-230-u01-ex1: Two norms on C([0,1])

Prompt: On $C([0,1])$ consider the sup norm $\|f\|_\infty=\sup_{x\in[0,1]}|f(x)|$ and the integral norm $\|f\|_1=\int_0^1|f(x)|\,dx$. Let $f_n(x)=x^n$ for $n\ge 1$.

1. Compute $\|f_n\|_\infty$ and $\|f_n\|_1$ for general $n$, with justification.
2. Decide whether there is a constant $C>0$ such that $\|f\|_\infty\le C\,\|f\|_1$ for every $f\in C([0,1])$. Prove your answer.
3. Explain in one or two sentences what this shows about equivalence of norms, and name the hypothesis of the finite-dimensional theorem that fails here.

Instructor reference: `content/courses/MAT-230/units/01-normed-and-banach-spaces/instructor/MAT-230-u01-ex1.reference-solution.md`.

## Reference reasoning (instructor only)

**1. The two norms.** On $[0,1]$, $x\mapsto x^n$ is increasing for $n\ge1$, so $\sup_{[0,1]}x^n=1^n=1$: $\|f_n\|_\infty=1$ for every $n$. The integral norm is $\|f_n\|_1=\int_0^1 x^n\,dx=\big[\tfrac{x^{n+1}}{n+1}\big]_0^1=\tfrac{1}{n+1}$ (the integrand is nonnegative so $|x^n|=x^n$).

**2. No comparison constant.** Suppose $C>0$ satisfied $\|f\|_\infty\le C\|f\|_1$ for all $f\in C([0,1])$. Applying it to $f_n$ gives $1\le C/(n+1)$, i.e. $n+1\le C$ for every $n\ge1$, impossible. Hence no such $C$ exists.

Note the other direction *does* hold: $\|f\|_1=\int_0^1|f|\le\int_0^1\|f\|_\infty=\|f\|_\infty$, so $\|\cdot\|_1\le\|\cdot\|_\infty$ with constant $1$. Equivalence fails because one of the two inequalities fails, which is enough.

**3. Interpretation.** Two norms are equivalent iff each bounds the other up to a constant. The theorem that all norms on a vector space are equivalent has the hypothesis that the space is finite-dimensional (its proof uses compactness of the unit sphere). $C([0,1])$ is infinite-dimensional (Example 6: the very family $x^n$ is an infinite linearly independent set), so the theorem does not apply, and the computation shows its conclusion genuinely fails.

**Alternative valid approaches.** Any family with sup norm bounded below and integral norm tending to $0$ works (narrow triangular spikes of height 1; $\sin$-based bumps). A learner may also phrase part 2 via the unit ball: the $\|\cdot\|_1$-unit ball is not bounded in $\|\cdot\|_\infty$. Accept these. Do not require the reverse inequality unless the learner claims the norms are "incomparable", in which case point out that $\|\cdot\|_1\le\|\cdot\|_\infty$ does hold.

**Common gaps.** Stating $\int_0^1x^n=1/(n+1)$ for $n=1,2,3$ only; concluding "not equivalent" without the limit argument; writing the failing inequality in the wrong direction ($\|f\|_1\le C\|f\|_\infty$, which is true); forgetting to name finite dimensionality.

#### MAT-230-u01-ex2: Completeness fails for the integral norm

Prompt: Show that $(C([0,1]),\|\cdot\|_1)$, with $\|f\|_1=\int_0^1|f(x)|\,dx$, is **not** a Banach space.

That is, construct a sequence $(f_n)$ of continuous functions on $[0,1]$ which is Cauchy for $\|\cdot\|_1$, and prove that there is no continuous $g$ with $\|f_n-g\|_1\to 0$.

State precisely where continuity of the would-be limit is used.

Instructor reference: `content/courses/MAT-230/units/01-normed-and-banach-spaces/instructor/MAT-230-u01-ex2.reference-solution.md`.

## Reference reasoning (instructor only)

**Construction.** For $n\ge2$ define the continuous piecewise-linear function
$$f_n(x)=\begin{cases}0,& 0\le x\le\tfrac12,\\ n\,(x-\tfrac12),& \tfrac12< x<\tfrac12+\tfrac1n,\\ 1,& \tfrac12+\tfrac1n\le x\le 1.\end{cases}$$
Each $f_n$ is continuous (the pieces agree at the junctions) and $0\le f_n\le1$.

**Cauchy in $\|\cdot\|_1$.** For $m>n$, the ramp of $f_m$ is steeper and starts at the same point, so $f_m\ge f_n$ everywhere and $f_m-f_n$ vanishes outside $(\tfrac12,\tfrac12+\tfrac1n)$, where it is at most $1$. Hence
$$\|f_m-f_n\|_1=\int_{1/2}^{1/2+1/n}(f_m-f_n)\,dx\le\tfrac1n.$$
So $\|f_m-f_n\|_1\le 1/\min(m,n)\to0$: the sequence is Cauchy.

**No continuous limit.** Suppose $g\in C([0,1])$ with $\|f_n-g\|_1\to0$.

*On $[0,\tfrac12]$:* $f_n=0$ there, so $\int_0^{1/2}|g|\,dx=\int_0^{1/2}|f_n-g|\,dx\le\|f_n-g\|_1\to0$; the left side does not depend on $n$, so $\int_0^{1/2}|g|=0$. A continuous nonnegative function with zero integral on an interval is identically zero there, so $g=0$ on $[0,\tfrac12]$.

*On $[\tfrac12+\varepsilon,1]$ for fixed $\varepsilon>0$:* for $n>1/\varepsilon$, $f_n=1$ there, so $\int_{1/2+\varepsilon}^1|g-1|\le\|f_n-g\|_1\to0$, hence $g=1$ on $[\tfrac12+\varepsilon,1]$ by the same continuity argument. As $\varepsilon$ was arbitrary, $g=1$ on $(\tfrac12,1]$.

*Contradiction:* $g$ is continuous at $\tfrac12$, yet $\lim_{x\uparrow 1/2}g(x)=0$ and $\lim_{x\downarrow1/2}g(x)=1$. No such $g$ exists, so $(f_n)$ has no limit in $(C([0,1]),\|\cdot\|_1)$, which is therefore not complete.

**Where continuity is used.** Twice to pass from "zero integral of $|g|$ (or $|g-1|$) on an interval" to "identically zero (or one) on that interval", and once at the end at the point $\tfrac12$. Without continuity (allowing arbitrary functions) the jump function itself would be the limit; this is precisely why $L^1$ will be built later from equivalence classes of measurable functions.

**Alternative valid approaches.** Ramps centred at $\tfrac12$ (symmetric), smooth bumps, or a sequence converging in $\|\cdot\|_1$ to a function with a jump anywhere in $(0,1)$. Some learners argue via the completion $L^1$: "the limit is the indicator of $[\tfrac12,1]$, which is not continuous". That identifies the right obstruction but is incomplete unless they show *no* continuous function is a limit (the limit in $L^1$ is unique only up to a.e. equality, which the course has not yet established); mark as partially met on limit-identification with a precise note.

**Common gaps.** Omitting the Cauchy estimate; asserting the limit is the step function without proving no continuous $g$ works; not isolating the point $\tfrac12$.

#### MAT-230-u01-ex3: What completeness buys

Prompt: In your own words, and without the notes open, explain in under 200 words why completeness of a normed space matters when one solves problems by approximation. Then give one concrete example of a sequence that is Cauchy in a normed space but whose limit lies outside that space (you may use the example from exercise 2 or another).

Instructor reference: `content/courses/MAT-230/units/01-normed-and-banach-spaces/instructor/MAT-230-u01-ex3.reference-solution.md`.

# Reference reasoning

A Cauchy estimate says later approximations agree with one another; it does not by itself give a solution inside the chosen space. Completeness supplies an element of that same space to which the approximations converge. One must still prove that the limit solves the equation, usually using continuity of the relevant operations. For example, continuous ramps approximating the jump $1_{(1/2,1]}$ are Cauchy for the integral norm, but no continuous function is their integral-norm limit: zero integral distance to the step would force different one-sided limiting values. Thus the normed space of continuous functions with that norm is incomplete. This is distinct from saying a subset is closed, which depends on an ambient space. Other mathematically valid examples are acceptable; the rationals illustrate incomplete metric spaces but are not a real or complex vector space under the field convention of this course.

This is one acceptable response, not a phrase-matching answer. Accept complete alternate reasoning.

#### MAT-230-u01-ex4: Completeness depends on both the space and the norm

Prompt: (a) Prove that $\|f\|_\infty$ and $\|f\|_1=\int_0^1|f|$ are norms on $C([0,1])$, saying where continuity is needed. (b) Reconstruct the proof that the sup norm is complete. (c) Construct a continuous sequence that is Cauchy in integral norm but has no continuous limit in that norm. (d) Explain why equivalence of the two norms would contradict (b) and (c), and why their restrictions to each fixed finite-dimensional polynomial space are nonetheless equivalent.

Instructor reference: `content/courses/MAT-230/units/01-normed-and-banach-spaces/instructor/MAT-230-u01-ex4.reference-solution.md`.

# Completeness depends on both the space and the norm — reference reasoning

(a) Homogeneity and triangle inequalities follow pointwise and then by supremum or integration. Supremum definiteness is immediate. If a continuous function has nonzero value at a point, continuity gives an interval of positive length on which its absolute value is bounded below by a positive constant (one-sided at an endpoint), so its integral norm is positive. (b) A sup-Cauchy sequence has a scalar limit at each point. Pass the Cauchy estimate to the pointwise limit to get uniform convergence; the uniform limit is continuous by the epsilon/3 argument, so the limit lies in the same space. (c) Use continuous ramps which are 0 on $[0,1/2]$, rise linearly to 1 on $[1/2,1/2+1/n]$, and equal 1 afterwards, for $n\ge2$. Their integral distance to the step $h=1_{(1/2,1]}$ is $1/(2n)$, so they are integral-Cauchy. If a continuous $g$ were an integral limit, the triangle inequality gives $\int|g-h|=0$. Continuity forces $g=0$ on $(0,1/2)$ and $g=1$ on $(1/2,1)$, impossible at $1/2$. (d) Equivalent norms have the same Cauchy sequences and convergent sequences by their two bounds, so completeness transfers, contradicting(c). On polynomials of degree at most a fixed $N$, both are norms and finite-dimensional norm equivalence applies. The equivalence constants may depend on $N$; there is no uniform constant for the entire infinite-dimensional space.

Accept complete alternative arguments; this is an authored reference, not an exhaustive oracle.

### MAT-230-u02 — Series, bounded operators and the dual

Objectives: Prove that a normed space is Banach if and only if every absolutely summable series is summable, and use the criterion.; Prove that a linear operator between normed spaces is continuous if and only if it is bounded.; Compute or bound operator norms, including for an integral operator, and prove the submultiplicative inequality.; Explain why B(V,W) is a Banach space when W is, and why the dual space is always Banach.

#### MAT-230-u02-ex1: Three descriptions of the operator norm

Prompt: Let $V,W$ be normed spaces and $T\in B(V,W)$, with $\|T\|=\sup_{\|v\|=1}\|Tv\|$ as in Definition 25.

1. Prove that $\|T\|=\sup_{v\neq 0}\dfrac{\|Tv\|}{\|v\|}=\inf\{C\ge0 : \|Tv\|\le C\|v\| \text{ for all } v\in V\}$.
2. Deduce that $\|Tv\|\le\|T\|\,\|v\|$ for all $v$.
3. If $S\in B(W,U)$ for a third normed space $U$, prove $\|ST\|\le\|S\|\,\|T\|$.

Assume $V\neq\{0\}$.

Instructor reference: `content/courses/MAT-230/units/02-series-operators-and-the-dual/instructor/MAT-230-u02-ex1.reference-solution.md`.

## Reference reasoning (instructor only)

**1.** Write $A=\sup_{\|v\|=1}\|Tv\|$, $B=\sup_{v\ne0}\|Tv\|/\|v\|$, $C_*=\inf\{C\ge0:\|Tv\|\le C\|v\|\ \forall v\}$.

$A\le B$: every unit vector is a nonzero vector with $\|Tv\|/\|v\|=\|Tv\|$. $B\le A$: for $v\ne0$, $u=v/\|v\|$ is a unit vector and $\|Tv\|/\|v\|=\|T(\|v\|u)\|/\|v\|=\|Tu\|\le A$ by linearity and homogeneity. So $A=B$.

$C_*\le B$: $B$ itself is admissible, since $\|Tv\|\le B\|v\|$ for $v\ne0$ by definition of $B$ and trivially for $v=0$. $B\le C_*$: if $C$ is admissible then $\|Tv\|/\|v\|\le C$ for all $v\ne0$, so $B\le C$; take the infimum over admissible $C$. (The set of admissible $C$ is nonempty because $T$ is bounded.)

**2.** $B$ is admissible and equals $\|T\|$, so $\|Tv\|\le\|T\|\|v\|$ for all $v$ (the case $v=0$ is trivial).

**3.** For any $v$, $\|STv\|\le\|S\|\,\|Tv\|\le\|S\|\,\|T\|\,\|v\|$. So $\|S\|\|T\|$ is an admissible constant for $ST$, and by part 1 $\|ST\|\le\|S\|\|T\|$. (Also shows $ST$ is bounded, so $ST\in B(V,U)$.)

**Alternatives.** Some learners prove 3 directly from the supremum over unit vectors; fine. Some define $\|T\|$ via $\sup_{\|v\|\le1}$; equality with the other forms is a one-line extra and should be acknowledged, not penalised.

**Common gaps.** Forgetting $v=0$ in part 2; in part 1 showing only $A\le B$; treating the infimum as a minimum without noting the supremum is admissible.

#### MAT-230-u02-ex2: The Volterra operator

Prompt: On $C([0,1])$ with the sup norm define $(Tf)(x)=\int_0^x f(t)\,dt$.

1. Show that $T$ maps $C([0,1])$ into itself and is linear.
2. Prove that $T$ is bounded and compute $\|T\|$ exactly. Give both the upper bound and a function (or sequence of functions) showing it is sharp.
3. Show that $T$ is **not** surjective onto $C([0,1])$. (Which functions can be of the form $Tf$?)
4. Let $D$ denote differentiation on the range of $T$, so that $D(Tf)=f$. Using $f_n(x)=\sin(n\pi x)$ or otherwise, show that $D$ is not bounded with respect to the sup norm. Why does this not contradict anything proved in this unit?

Instructor reference: `content/courses/MAT-230/units/02-series-operators-and-the-dual/instructor/MAT-230-u02-ex2.reference-solution.md`.

## Reference reasoning (instructor only)

**1.** For continuous $f$, $Tf(x)=\int_0^xf$ is differentiable with $(Tf)'=f$ by the fundamental theorem of calculus, hence continuous. Linearity is linearity of the integral.

**2.** For $x\in[0,1]$, $|Tf(x)|\le\int_0^x|f|\le x\|f\|_\infty\le\|f\|_\infty$, so $\|Tf\|_\infty\le\|f\|_\infty$ and $\|T\|\le1$. For $f\equiv1$: $Tf(x)=x$, $\|Tf\|_\infty=1=\|f\|_\infty$, so $\|T\|\ge1$. Hence $\|T\|=1$, attained.

**3.** Every $Tf$ is $C^1$ with $(Tf)(0)=0$. The constant function $1$ (or any $g$ with $g(0)\ne0$, or $x\mapsto|x-\tfrac12|$, which is not differentiable at $\tfrac12$) is continuous but not of this form. So $T$ is not surjective. In fact the range is exactly $\{g\in C^1([0,1]):g(0)=0\}$.

**4.** With $f_n(x)=\sin(n\pi x)$: $\|f_n\|_\infty=1$ and $g_n=Tf_n$, $g_n(x)=\frac{1-\cos(n\pi x)}{n\pi}$, so $\|g_n\|_\infty=\frac{2}{n\pi}$. Then $Dg_n=f_n$ and $\|Dg_n\|_\infty/\|g_n\|_\infty=\frac{n\pi}{2}\to\infty$. So $D$ is linear but unbounded on $(\operatorname{ran}T,\|\cdot\|_\infty)$. No contradiction: Theorem 22 says continuous iff bounded, and $D$ is neither; the theorems of this unit never promised that a linear map is bounded. (In unit 4 the bounded inverse theorem will say that a bijective bounded operator *between Banach spaces* has a bounded inverse; the range of $T$ with the sup norm is not complete, so that theorem will not apply either, which is the real reason the inverse can be unbounded.)

**Alternatives.** Any sequence $f_n$ with $\|f_n\|_\infty$ bounded and $\|Tf_n\|_\infty\to0$ works for part 4 (e.g. high-frequency oscillations, or $f_n=\cos(n\pi x)$). For sharpness in part 2 any $f$ of constant sign with $|f|\equiv1$ works.

**Common gaps.** Claiming $\|T\|<1$ because the bound $x\|f\|_\infty$ is strict for $x<1$ (missing the endpoint); forgetting to exhibit the attaining function; in part 4 computing the ratio the wrong way round.

#### MAT-230-u02-ex3: Why the summability test is convenient

Prompt: In under 200 words, explain why Theorem 19 (a normed space is Banach iff every absolutely summable series is summable) is often easier to use than the definition of completeness, and point to the exact step in the proof that $B(V,W)$ is Banach where it is used.

Instructor reference: `content/courses/MAT-230/units/02-series-operators-and-the-dual/instructor/MAT-230-u02-ex3.reference-solution.md`.

# Reference reasoning

A series gives a concrete way to add successive corrections. If their norms have finite sum, tails are small uniformly, so the partial sums are Cauchy; completeness gives a limit. Conversely one extracts a Cauchy subsequence with summable successive distances and recovers the full limit. To prove $B(V,W)$ is complete when $W$ is Banach, suppose $\sum\|T_n\|<\infty$. For each $v$, the series $\sum T_nv$ is absolutely summable in $W$, so has a sum $Tv$. Linearity follows from the finite sums and limits, and $\|T-\sum_{n\le N}T_n\|\le\sum_{n>N}\|T_n\|$ proves operator-norm convergence and boundedness. Thus every absolutely summable operator series converges, and the equivalence theorem proves completeness of $B(V,W)$. Completeness is needed in the target $W$, not in $V$.

This is one acceptable response, not a phrase-matching answer. Accept complete alternate reasoning.

#### MAT-230-u02-ex4: Solve an integral equation by an operator series

Prompt: On $X=C([0,1])$ with the sup norm let $(Tf)(x)=\int_0^x f(t)dt$. (a) Prove for $n\ge1$ that $(T^nf)(x)=\frac1{(n-1)!}\int_0^x(x-t)^{n-1}f(t)dt$ and $\|T^n\|=1/n!$. (b) For every real or complex $\lambda$, prove $\sum_{n=0}^\infty\lambda^nT^n$ converges in operator norm and is a two-sided inverse of $I-\lambda T$. State the completeness used. (c) Deduce existence, uniqueness and the bound $\|f\|_\infty\le e^{|\lambda|}\|g\|_\infty$ for $f-\lambda Tf=g$. (d) Show evaluation at a point is a bounded functional of norm 1 on $X$, and use it to bound $|f(x_0)|$. Why does the same evaluation fail to be bounded for the integral norm on continuous functions?

Instructor reference: `content/courses/MAT-230/units/02-series-operators-and-the-dual/instructor/MAT-230-u02-ex4.reference-solution.md`.

# Solve an integral equation by an operator series — reference reasoning

(a) Induct and interchange integrals over the triangle; continuity on a compact triangle justifies the interchange. Integrating the kernel in the extra variable gives the factorial. The absolute bound is $\|T^nf\|_\infty\le\|f\|_\infty/n!$, attained by $f=1$ at $x=1$. (b) The norm series is bounded by $\sum|\lambda|^n/n!=e^{|\lambda|}$. Since $X$ is Banach, $B(X)$ is Banach, so absolute summability gives an operator-norm limit $R$. Finite sums satisfy both $(I-\lambda T)R_N=R_N(I-\lambda T)=I-\lambda^{N+1}T^{N+1}$. The remainder norm tends to zero, and continuity of composition proves both inverse identities. No condition $|\lambda|<1$ is needed because of the factorial estimate. (c) Set $f=Rg$; the inverse gives uniqueness and the series bound gives the estimate. (d) $\delta_{x_0}(f)=f(x_0)$ has norm at most 1, with equality on the constant 1. Thus $|f(x_0)|\le e^{|\lambda|}\|g\|_\infty$. Continuous tents of height 1 centred at $x_0$ and widths tending to zero have integral norms tending to zero (one-sided tents at endpoints) while their evaluation remains 1. Therefore evaluation is unbounded for that norm.

Accept complete alternative arguments; this is an authored reference, not an exhaustive oracle.

### MAT-230-u03 — Subspaces, quotients and Baire category

Objectives: Prove that a subspace of a Banach space is itself Banach exactly when it is closed, and exhibit a dense proper subspace.; Define the quotient of a normed space by a closed subspace and explain why the quotient norm is a norm.; State the Baire category theorem precisely and use it to show a Banach space has no countable Hamel basis.; State the uniform boundedness principle with its completeness hypothesis and give an example showing the hypothesis cannot be dropped.

#### MAT-230-u03-ex1: Closed subspaces and a dense one

Prompt: Let $V$ be a Banach space and $W\subseteq V$ a linear subspace with the inherited norm.

1. Prove that $W$ is a Banach space if and only if $W$ is closed in $V$.
2. Let $P\subseteq C([0,1])$ be the subspace of polynomial functions, with the sup norm. Using the Weierstrass approximation theorem (which you may quote), show that $P$ is dense in $C([0,1])$ and that $P\neq C([0,1])$.
3. Conclude that $P$ is not complete, and exhibit explicitly a Cauchy sequence in $P$ with no limit in $P$.

Instructor reference: `content/courses/MAT-230/units/03-subspaces-quotients-and-baire-category/instructor/MAT-230-u03-ex1.reference-solution.md`.

## Reference reasoning (instructor only)

**1.** ($\Leftarrow$) Let $(w_n)$ be Cauchy in $W$. It is Cauchy in $V$, so $w_n\to v\in V$; $W$ closed gives $v\in W$, and $w_n\to v$ in $W$'s inherited norm. ($\Rightarrow$) Let $w_n\in W$, $w_n\to v$ in $V$. Then $(w_n)$ is Cauchy, hence converges in $W$ to some $w\in W$; in $V$ it converges to both $v$ and $w$, so $v=w\in W$. Thus $W$ is closed.

**2.** Weierstrass: for every $f\in C([0,1])$ and $\varepsilon>0$ there is a polynomial $p$ with $\|f-p\|_\infty<\varepsilon$; so $\overline P=C([0,1])$. $P\neq C([0,1])$: $f(x)=|x-\tfrac12|$ is continuous but not a polynomial (not differentiable at $\tfrac12$); or $e^x$ (a polynomial agreeing with $e^x$ on $[0,1]$ would have all derivatives equal to it at $0$, impossible for a polynomial of finite degree); or $\sin$.

**3.** If $P$ were complete it would be closed by part 1, so $P=\overline P=C([0,1])$, contradiction. Explicit Cauchy sequence: $p_n(x)=\sum_{k=0}^n x^k/k!$. Since $\sum_k 1/k!$ converges, $\|p_m-p_n\|_\infty\le\sum_{k=n+1}^m 1/k!\to0$, so $(p_n)$ is Cauchy in the sup norm; its uniform limit is $e^x$, which is not in $P$, and limits are unique, so $(p_n)$ has no limit in $P$.

**Alternatives.** Any sequence of polynomials converging uniformly to a non-polynomial (Bernstein polynomials of $|x-\tfrac12|$; partial sums of $\sum (-1)^k x^{2k}/(2k)!$). Accept density via Stone–Weierstrass if quoted correctly.

**Common gaps.** Omitting uniqueness of limits in 1; claiming $|x|$ is not a polynomial "because it has a corner" without saying polynomials are differentiable; forgetting to justify Cauchy in 3.

#### MAT-230-u03-ex2: No countable Hamel basis

Prompt: A Hamel basis of a vector space is a linearly independent set $H$ such that every vector is a *finite* linear combination of elements of $H$. Let $V$ be an infinite-dimensional Banach space.

1. Show that every finite-dimensional subspace $F\subseteq V$ is closed. (You may use that all norms on a finite-dimensional space are equivalent, and that finite-dimensional normed spaces are complete.)
2. Show that a proper closed subspace of a normed space has empty interior.
3. Suppose, for contradiction, that $V$ has a countable Hamel basis $\{h_1,h_2,\dots\}$. Write $V$ as a countable union of finite-dimensional subspaces and apply the Baire category theorem to reach a contradiction.
4. Conclude: a Hamel basis of an infinite-dimensional Banach space is uncountable. Does this argument use completeness of $V$? Where?

Instructor reference: `content/courses/MAT-230/units/03-subspaces-quotients-and-baire-category/instructor/MAT-230-u03-ex2.reference-solution.md`.

## Reference reasoning (instructor only)

**1.** A finite-dimensional normed space is isomorphic to $K^n$ with some norm; all norms on $K^n$ are equivalent and $K^n$ is complete in the Euclidean norm, hence in every norm. So $F$ is complete; by Proposition 30 (complete $\Rightarrow$ closed) $F$ is closed in $V$.

**2.** Suppose a subspace $F$ contains $B(x,r)$. Then for $\|y\|<r$, $x+y\in F$ and $x\in F$, so $y\in F$: $F\supseteq B(0,r)$. For arbitrary $v\ne0$, $\tfrac{r}{2\|v\|}v\in B(0,r)\subseteq F$, so $v\in F$ by closure under scaling. Hence $F=V$. Contrapositive: a proper subspace contains no ball, i.e. has empty interior.

**3.** Let $F_n=\operatorname{span}\{h_1,\dots,h_n\}$. Each $F_n$ is finite-dimensional, hence closed (part 1), and proper (since $V$ is infinite-dimensional, $h_{n+1}\notin F_n$ by independence), hence nowhere dense (part 2). Every $v\in V$ is a *finite* combination of basis vectors, so lies in some $F_n$: $V=\bigcup_nF_n$. Baire's theorem (V complete) says some $F_n$ contains an open ball, contradicting empty interior.

**4.** Therefore no countable Hamel basis exists; any Hamel basis is uncountable. Completeness of $V$ is used exactly once, in applying Baire's theorem to $V=\bigcup F_n$; part 1 used completeness of the finite-dimensional $F_n$, which holds regardless of $V$. The result fails without completeness: $c_{00}$ has the countable Hamel basis $\{e_n\}$.

**Alternatives.** Some learners show $F_n$ nowhere dense directly by exhibiting, in any ball around $x\in F_n$, the point $x+\varepsilon h_{n+1}/\|h_{n+1}\|$. Accept. Some use the Baire formulation "countable union of nowhere dense sets has empty interior"; accept.

**Common gaps.** Not justifying that $F_n$ is closed; forgetting "finite" in the definition of a Hamel basis when writing $V=\bigcup F_n$; applying Baire without naming completeness.

#### MAT-230-u03-ex3: Where completeness enters uniform boundedness

Prompt: Let $c_{00}$ be the space of sequences with only finitely many nonzero terms, with the sup norm, and define $T_n:c_{00}\to\mathbb{R}$ by $T_n(x)=n\,x_n$.

1. Show that for each fixed $x\in c_{00}$, $\sup_n|T_n(x)|<\infty$.
2. Compute $\|T_n\|$ and conclude that $\sup_n\|T_n\|=\infty$.
3. In under 150 words, explain why this does not contradict the uniform boundedness principle, and say exactly where its proof uses completeness.

Instructor reference: `content/courses/MAT-230/units/03-subspaces-quotients-and-baire-category/instructor/MAT-230-u03-ex3.reference-solution.md`.

# Reference reasoning

If $x\in c_{00}$, then $x_n=0$ beyond a finite index, so the sequence $T_nx=nx_n$ has only finitely many nonzero values and is bounded. For $\|x\|_\infty\le1$, $|T_nx|\le n$, and $x=e_n$ attains the bound, so $\|T_n\|=n$. Thus the family is pointwise bounded but not uniformly bounded in operator norm. Uniform boundedness requires a Banach domain. The domain $c_{00}$ is incomplete: truncations of $(1/n)$ converge in sup norm to an infinite-support element of $c_0$, outside $c_{00}$. In the proof of uniform boundedness, the closed sets $E_k=\{x:\sup_n|T_nx|\le k\}$ cover the domain; Baire is used to assert that some $E_k$ has interior. That inference is unavailable on this incomplete domain. The scalar target is complete, but target completeness does not replace the domain hypothesis.

Accept logically complete alternatives; do not grade by phrase matching.

#### MAT-230-u03-ex4: A quotient norm and an infinite-dimensional Banach space

Prompt: In $\ell^\infty$ let $c_0$ be the sequences tending to zero. (a) Prove $c_0$ is closed. (b) Prove $\|x+c_0\|=\limsup_{n\to\infty}|x_n|$ for the quotient norm. (c) Show $\ell^\infty/c_0$ is infinite-dimensional by constructing arbitrarily many independent cosets, and explain why it is Banach. (d) Apply Baire to prove it has no countable Hamel basis, stating each hypothesis. Contrast the quotient by $c_{00}$, whose quotient distance is only a seminorm.

Instructor reference: `content/courses/MAT-230/units/03-subspaces-quotients-and-baire-category/instructor/MAT-230-u03-ex4.reference-solution.md`.

# A quotient norm and an infinite-dimensional Banach space — reference reasoning

(a) If $x^{(j)}\to x$ uniformly and each $x^{(j)}$ tends to 0, choose $j$ making the uniform error less than $\varepsilon/2$, then a tail of $x^{(j)}$ below $\varepsilon/2$. Hence $x_n\to0$. (b) For any $y\in c_0$, $\limsup|x_n|\le\|x-y\|_\infty$ by the tail triangle inequality. Conversely subtract the truncation of $x$ to its first $N$ coordinates, a member of $c_0$; its residual norm is $\sup_{n>N}|x_n|$, which decreases to the limsup. (c) Partition $\mathbb N$ into any finite number $m$ of disjoint infinite sets $A_j$. If $\sum a_j1_{A_j}$ tends to 0, looking along $A_j$ gives $a_j=0$, so their cosets are independent. The ambient $\ell^\infty$ is Banach and $c_0$ closed, so the quotient completeness theorem applies. (d) A countable Hamel basis would express the quotient as a countable union of its finite-dimensional spans. Each span is closed and proper, hence nowhere dense; Baire forbids that union in a nonempty complete metric space. The subspace $c_{00}$ is not closed: its sup closure is $c_0$. Any nonzero element of $c_0\setminus c_{00}$, such as $(1/n)$, gives a nonzero coset with quotient distance zero, so the proposed distance is not a norm.

Accept complete alternative arguments; this is an authored reference, not an exhaustive oracle.

### MAT-230-u04 — Open mapping, closed graph and Zorn's lemma

Objectives: State the open mapping theorem and the bounded inverse theorem with hypotheses, and use them to compare two complete norms.; State the closed graph theorem and use it to prove boundedness of an operator defined on a Banach space.; Explain why the unbounded inverse of the Volterra operator does not contradict the bounded inverse theorem.; State Zorn's lemma precisely and use it to show every vector space has a Hamel basis.

#### MAT-230-u04-ex1: Two complete norms that compare are equivalent

Prompt: Let $V$ be a vector space carrying two norms $\|\cdot\|_a$ and $\|\cdot\|_b$, and suppose $V$ is complete with respect to **both**. Suppose also that there is $C>0$ with $\|v\|_a\le C\|v\|_b$ for all $v\in V$.

1. Prove that the two norms are equivalent, i.e. there is also $c>0$ with $\|v\|_b\le c\|v\|_a$ for all $v$.
2. State precisely which theorem you used and check each of its hypotheses.
3. Show by example that the conclusion can fail if completeness in one of the norms is dropped. (Unit 1 contains a suitable pair of norms on $C([0,1])$.)

Instructor reference: `content/courses/MAT-230/units/04-open-mapping-closed-graph-and-zorn/instructor/MAT-230-u04-ex1.reference-solution.md`.

## Reference reasoning (instructor only)

**1–2.** Let $I:(V,\|\cdot\|_b)\to(V,\|\cdot\|_a)$ be the identity. It is linear and bijective, and $\|Iv\|_a=\|v\|_a\le C\|v\|_b$ shows it is bounded. Both domain and codomain are Banach spaces by hypothesis (completeness in $\|\cdot\|_b$ and in $\|\cdot\|_a$ respectively). By the bounded inverse theorem (Corollary 38; hypotheses: Banach spaces on both sides, $I$ bounded and bijective), $I^{-1}:(V,\|\cdot\|_a)\to(V,\|\cdot\|_b)$ is bounded: there is $c>0$ with $\|v\|_b=\|I^{-1}v\|_b\le c\|v\|_a$. Together with the given inequality, the norms are equivalent.

**3.** On $C([0,1])$ take $\|\cdot\|_b=\|\cdot\|_\infty$ and $\|\cdot\|_a=\|\cdot\|_1$: $\|f\|_1\le\|f\|_\infty$ (so $C=1$), $C([0,1])$ is complete in $\|\cdot\|_\infty$ but not in $\|\cdot\|_1$ (unit 1, exercise 2), and the norms are not equivalent (unit 1, exercise 1: $x^n$). The hypothesis that fails is completeness in $\|\cdot\|_a=\|\cdot\|_1$.

**Alternatives.** Applying the open mapping theorem directly to $I$ (open at $0$ gives the inequality) is equivalent and fine. Some learners phrase the counterexample with the roles of $a,b$ swapped; check the direction of the given inequality matches.

**Common gaps.** Not stating that *both* completeness hypotheses are needed; using the counterexample without saying which norm fails to be complete; confusing "comparable" with "equivalent".

#### MAT-230-u04-ex2: Boundedness from a closed graph

Prompt: Let $T:C([0,1])\to C([0,1])$ be a linear map (sup norm on both sides) with the following property: whenever $f_n\to f$ uniformly and $Tf_n\to g$ uniformly, one has $Tf=g$.

1. Prove that $T$ is bounded.
2. Let $D$ be differentiation, defined on the subspace $C^1_0=\{g\in C^1([0,1]):g(0)=0\}$ with the sup norm, mapping into $C([0,1])$. Show that $D$ has a closed graph (if $g_n\to g$ and $g_n'\to h$ uniformly then $g\in C^1_0$ and $g'=h$), yet $D$ is unbounded (unit 2). Explain precisely why this does not contradict part 1.

Instructor reference: `content/courses/MAT-230/units/04-open-mapping-closed-graph-and-zorn/instructor/MAT-230-u04-ex2.reference-solution.md`.

## Reference reasoning (instructor only)

**1.** The hypothesis says: if $(f_n,Tf_n)\to(f,g)$ in $C([0,1])\times C([0,1])$ then $(f,g)=(f,Tf)\in\Gamma(T)$; that is, $\Gamma(T)$ is closed. $C([0,1])$ with the sup norm is a Banach space (Theorem 16). By the closed graph theorem (Theorem 40; hypotheses: both spaces Banach, $T$ linear, graph closed), $T$ is bounded.

**2.** *Closed graph of $D$.* Let $g_n\in C^1_0$, $g_n\to g$ and $g_n'\to h$ uniformly. Since $g_n(0)=0$, $g_n(x)=\int_0^xg_n'(t)\,dt$. Uniform convergence of $g_n'$ to $h$ (continuous as a uniform limit of continuous functions) allows passing to the limit in the integral: $g(x)=\int_0^xh(t)\,dt$. Hence $g$ is $C^1$ with $g'=h$ and $g(0)=0$, so $g\in C^1_0$ and $Dg=h$: the graph is closed.

*Unbounded.* From unit 2: $g_n(x)=\frac{1-\cos(n\pi x)}{n\pi}\in C^1_0$, $\|g_n\|_\infty=\frac2{n\pi}$, $\|Dg_n\|_\infty=1$, so $\|Dg_n\|/\|g_n\|\to\infty$.

*No contradiction.* The closed graph theorem requires the domain to be a Banach space. $C^1_0$ with the sup norm is not complete: $p_n(x)=$ a sequence of $C^1$ functions vanishing at $0$ converging uniformly to $x\mapsto|x-\tfrac12|-\tfrac12$ (not differentiable at $\tfrac12$) is Cauchy in the sup norm with no limit in $C^1_0$. (Equivalently: $C^1_0$ is a dense proper subspace of $\{f\in C([0,1]):f(0)=0\}$, hence not closed, hence not complete by Proposition 30.) So the hypothesis fails and the theorem says nothing about $D$.

**Alternatives.** Learners may show the graph of $D$ closed via the mean value theorem instead of integration; accept if the limit interchange is justified. For non-completeness any dense-proper-subspace argument suffices.

**Common gaps.** Forgetting to show $g(0)=0$; asserting $g'=h$ without justifying the interchange of limit and derivative; identifying the failed hypothesis as "D is not linear" (it is linear).

#### MAT-230-u04-ex3: Zorn's lemma and Hamel bases

Prompt: 1. Using Zorn's lemma, show that every vector space $V\neq\{0\}$ has a Hamel basis. Be explicit about the partially ordered set, why chains have upper bounds, and why a maximal element spans.
2. In under 120 words, combine this with the result of unit 3 (no countable Hamel basis in an infinite-dimensional Banach space) to explain why Hamel bases are the wrong notion of basis for Banach spaces, and what notion will replace them for Hilbert spaces later in the course.

Instructor reference: `content/courses/MAT-230/units/04-open-mapping-closed-graph-and-zorn/instructor/MAT-230-u04-ex3.reference-solution.md`.

# Reference reasoning

Order the linearly independent subsets of $V$ by inclusion, including the empty set. A chain has upper bound its union: every finite subset of that union lies in a single member of the chain, so no nontrivial finite linear dependence is possible. Zorn supplies a maximal independent set $B$. If a vector $v$ lay outside its finite linear span, then $B\cup\{v\}$ would be independent, contradicting maximality; hence $B$ is a Hamel basis. In an infinite-dimensional Banach space this basis is uncountable by the preceding Baire argument. Hamel expansions are finite and algebraic, and do not describe convergence of successive approximations. In Hilbert space an orthonormal basis instead supplies norm-convergent, potentially infinite series, whose coefficients and convergence are controlled by the inner product. This is a distinct notion of basis, not a countable Hamel basis disguised by notation. The argument for Hamel bases uses Zorn/choice; existence of a maximal compatible atlas in MAT-261 used a different explicit construction.

Accept logically complete alternatives; do not grade by phrase matching.

#### MAT-230-u04-ex4: One space, two norms: units 1 to 4 together

Prompt: Let $C^1([0,1])$ be the space of continuously differentiable functions on $[0,1]$ (one-sided derivatives at the endpoints), with
$$\|f\|_{C^1}=\|f\|_\infty+\|f'\|_\infty .$$
The exercise draws on each of units 1 to 4; cite each result by its number where you use it.

1. Prove that $\|\cdot\|_{C^1}$ is a norm and that $(C^1([0,1]),\|\cdot\|_{C^1})$ is a Banach space.
2. Show that $\|f\|_\infty\le\|f\|_{C^1}$ for every $f\in C^1([0,1])$, and that the two norms are not equivalent on $C^1([0,1])$.
3. Without constructing any Cauchy sequence, deduce from parts 1 and 2 and a theorem of unit 4 that $(C^1([0,1]),\|\cdot\|_\infty)$ is not complete. State the theorem (or the result of exercise 1) and check each of its hypotheses.
4. Reach the same conclusion by a route from unit 3: show that $C^1([0,1])$ is a dense proper subspace of $(C([0,1]),\|\cdot\|_\infty)$ and conclude. You may quote the Weierstrass approximation theorem.
5. Let $Df=f'$. Show that $D:(C^1([0,1]),\|\cdot\|_{C^1})\to(C([0,1]),\|\cdot\|_\infty)$ is bounded, find $\|D\|$, and decide whether the supremum in its definition is attained. Then, in at most three sentences, contrast this with $D$ on $C^1([0,1])$ carrying the sup norm (unit 2), and say what the exercise shows about the choice of norm and about completeness.

Instructor reference: `content/courses/MAT-230/units/04-open-mapping-closed-graph-and-zorn/instructor/MAT-230-u04-ex4.reference-solution.md`.

## Reference reasoning (instructor only)

**1. Norm and completeness.** Definiteness: $\|f\|_{C^1}=0$ forces $\|f\|_\infty=0$, so $f=0$. Homogeneity: $(\lambda f)'=\lambda f'$, so both terms scale by $|\lambda|$. Triangle inequality: $(f+g)'=f'+g'$, and the sup norm satisfies the triangle inequality (Proposition 11), applied once to the functions and once to their derivatives.

Completeness follows the three-step template of Theorem 16. Let $(f_n)$ be Cauchy for $\|\cdot\|_{C^1}$. Since $\|f_n-f_m\|_\infty\le\|f_n-f_m\|_{C^1}$ and $\|f_n'-f_m'\|_\infty\le\|f_n-f_m\|_{C^1}$, both $(f_n)$ and $(f_n')$ are Cauchy in $(C([0,1]),\|\cdot\|_\infty)$, which is complete (Theorem 16). So $f_n\to f$ and $f_n'\to h$ uniformly, with $f,h\in C([0,1])$.

*Candidate in the space.* For each $n$ and $x$, $f_n(x)=f_n(0)+\int_0^xf_n'(t)\,dt$ by the fundamental theorem of calculus. As $n\to\infty$, $f_n(x)\to f(x)$, $f_n(0)\to f(0)$, and $\big|\int_0^x(f_n'-h)\big|\le x\|f_n'-h\|_\infty\to0$. Hence $f(x)=f(0)+\int_0^xh(t)\,dt$ for every $x$, and since $h$ is continuous, $f\in C^1([0,1])$ with $f'=h$.

*Convergence in norm.* $\|f_n-f\|_{C^1}=\|f_n-f\|_\infty+\|f_n'-h\|_\infty\to0$.

An equivalent route: $f\mapsto(f,f')$ is a linear isometry from $(C^1([0,1]),\|\cdot\|_{C^1})$ onto the graph of differentiation inside $C([0,1])\times C([0,1])$ with the sum norm, which is a Banach space by Proposition 39. The integration argument above shows the graph is closed (as in exercise 2), so the graph is Banach by Proposition 30, and so is $C^1([0,1])$ with $\|\cdot\|_{C^1}$.

**2. Comparable, not equivalent.** $\|f\|_\infty\le\|f\|_\infty+\|f'\|_\infty$ trivially. For $f_n(x)=x^n$ with $n\ge1$, $\|f_n\|_\infty=1$, and $f_n'(x)=nx^{n-1}$ has supremum $n$ on $[0,1]$, reached at $x=1$, so $\|f_n\|_{C^1}=n+1$. A constant $C$ with $\|f\|_{C^1}\le C\|f\|_\infty$ for all $f$ would give $n+1\le C$ for every $n$, which is impossible. So the norms are not equivalent. The ratio $n+1$ is the one met in unit 1, exercise 1, now for a different pair of norms.

**3. Through the bounded inverse theorem.** Suppose $(C^1([0,1]),\|\cdot\|_\infty)$ were complete. Let $I$ be the identity map of $C^1([0,1])$, with the $C^1$ norm on its domain and the sup norm on its codomain. It is linear and bijective, and bounded with $\|I\|\le1$ by part 2. Its domain is a Banach space by part 1, and its codomain is a Banach space by the assumption. By the bounded inverse theorem (Corollary 38) $I^{-1}$ is bounded, that is, $\|f\|_{C^1}\le c\|f\|_\infty$ for some $c>0$, so the two norms would be equivalent, contradicting part 2. Hence the sup norm is not complete on $C^1([0,1])$. Equivalently, this is exercise 1 of this unit with $\|\cdot\|_a=\|\cdot\|_\infty$, $\|\cdot\|_b=\|\cdot\|_{C^1}$ and $C=1$; the hypothesis that fails is completeness in $\|\cdot\|_a$.

**4. Through density and Proposition 30.** The polynomials $P$ satisfy $P\subseteq C^1([0,1])\subseteq C([0,1])$. By Weierstrass the closure of $P$ in the sup norm is $C([0,1])$, so the closure of $C^1([0,1])$ is $C([0,1])$ as well: $C^1([0,1])$ is dense. It is proper, because $x\mapsto|x-\tfrac12|$ is continuous on $[0,1]$ but not differentiable at $\tfrac12$. A dense proper subspace is not closed, since its closure is strictly larger than itself. As $(C([0,1]),\|\cdot\|_\infty)$ is a Banach space (Theorem 16), Proposition 30 says a subspace is complete exactly when it is closed. So $(C^1([0,1]),\|\cdot\|_\infty)$ is not complete, in agreement with part 3.

**5. The differentiation operator.** $D$ is linear and $\|Df\|_\infty=\|f'\|_\infty\le\|f\|_{C^1}$, so $D$ is bounded with $\|D\|\le1$. For $g_n=x^n/(n+1)$ we have $\|g_n\|_{C^1}=1$ and $\|Dg_n\|_\infty=n/(n+1)\to1$, so $\|D\|=1$. The supremum is not attained: if $\|f\|_{C^1}=1$ and $\|f'\|_\infty=1$, then $\|f\|_\infty=0$, so $f=0$, which contradicts $\|f\|_{C^1}=1$. This is the situation the unit 2 misconception warns about, an operator norm that no unit vector attains.

With the sup norm on its domain, $D$ is unbounded: $\|Dx^n\|_\infty/\|x^n\|_\infty=n$ (unit 2, exercise 2, showed the same on the range of the Volterra operator). So one linear map is bounded or unbounded according to the norm placed on its domain: a norm is a choice, and completeness belongs to the pair of space and norm, not to the space alone. With $\|\cdot\|_{C^1}$ the domain is complete and $D$ is bounded; with $\|\cdot\|_\infty$ the domain is incomplete, $D$ still has a closed graph (by the argument of exercise 2), and the closed graph theorem says nothing.

**Alternative valid approaches.** Part 1 through the graph of $D$, as above. Part 2 with any family whose derivatives grow faster than the functions, for instance $\sin(n\pi x)$, where $\|\cdot\|_{C^1}/\|\cdot\|_\infty=1+n\pi$. Part 3 by applying the open mapping theorem to $I$ directly. Part 4 with any continuous function that fails to be differentiable at some point of $[0,1]$. Part 5 with any sequence for which $\|f_n\|_\infty/\|f_n'\|_\infty\to0$.

**Common gaps.** In part 1, asserting $f'=h$ without the limit interchange (it is the uniform convergence of $f_n'$ that justifies it; uniform convergence of $f_n$ alone does not), or not showing that the limit lies in $C^1([0,1])$. In part 3, checking only one completeness hypothesis, or taking the identity in the wrong direction (the bounded direction is from the $C^1$ norm to the sup norm). In part 4, claiming density because every $C^1$ function is continuous. In part 5, asserting $\|D\|=1$ without a sequence, or claiming the norm is attained at $f=x$, for which $\|Df\|_\infty/\|f\|_{C^1}=1/2$.

### MAT-230-u05 — Hahn–Banach and the double dual

Objectives: Prove the real Hahn–Banach extension theorem from the one-dimensional extension lemma and Zorn's lemma.; Construct a norming functional and prove the canonical map into the double dual is an isometry.; Distinguish isometric embedding from reflexivity using c₀ and its duals.

#### MAT-230-u05-ex1: Distance becomes a functional

Prompt: Let $M$ be a closed linear subspace of a normed space $X$ and $x\notin M$. Put $d=\inf_{m\in M}\|x-m\|$. Show $d>0$ and construct $\varphi\in X^*$ such that $\varphi|_M=0$, $\|\varphi\|=1$, and $\varphi(x)=d$. Explain why closedness matters.

Instructor reference: `content/courses/MAT-230/units/05-hahn-banach-and-the-double-dual/instructor/MAT-230-u05-ex1.reference-solution.md`.

# Distance becomes a functional — reference reasoning

Closedness and $x\notin M$ imply a ball about $x$ misses $M$, hence $d>0$. On $M+\mathbb Fx$ define $f(m+tx)=td$. For $t\ne0$, $\|m+tx\|=|t|\|x+m/t\|\ge |t|d=|f(m+tx)|$; the case $t=0$ is immediate. Thus $\|f\|\le1$. Choose $m_k$ with $\|x-m_k\|\to d$; then $|f(x-m_k)|/\|x-m_k\|\to1$, so its norm is exactly one. Hahn–Banach extends it with norm one. If $M$ is not closed and $x\in\overline M\setminus M$, continuity forces every continuous functional vanishing on $M$ also to vanish at $x$.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u05-ex2: Extensions need not be unique

Prompt: On $\mathbb R^2$ with the $\ell^1$ norm, extend $f(t,0)=t$ from the first coordinate axis. Determine every norm-one linear extension. Repeat for the Euclidean norm and explain the difference.

Instructor reference: `content/courses/MAT-230/units/05-hahn-banach-and-the-double-dual/instructor/MAT-230-u05-ex2.reference-solution.md`.

# Extensions need not be unique — reference reasoning

Every extension is $F_a(s,t)=s+at$. Its operator norm for the $\ell^1$ domain is $\max(1,|a|)$: the inequality follows from $|s+at|\le\max(1,|a|)(|s|+|t|)$ and equality is obtained on a coordinate axis. Thus all $a\in[-1,1]$ work. In the Euclidean norm, Cauchy–Schwarz and equality in the direction $(1,a)$ give $\|F_a\|=\sqrt{1+a^2}$, so only $a=0$ has norm one. The theorem promises existence and preservation of the norm, not uniqueness; the geometry of the dual unit ball decides this example.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u05-ex3: The canonical map detects completeness

Prompt: Prove that if the canonical isometry $J:X\to X^{**}$ is surjective, then $X$ is complete. Then explain, using $c_0$, why completeness alone does not imply surjectivity.

Instructor reference: `content/courses/MAT-230/units/05-hahn-banach-and-the-double-dual/instructor/MAT-230-u05-ex3.reference-solution.md`.

# The canonical map detects completeness — reference reasoning

The dual of any normed space is Banach: an operator-norm Cauchy sequence of functionals has a pointwise limit, linearity passes to that limit, uniform bounds give boundedness, and the Cauchy estimate gives convergence in operator norm. Apply this to $X^*$, so $X^{**}$ is complete. If $(x_n)$ is Cauchy, $(Jx_n)$ converges to $F\in X^{**}$. Surjectivity gives $F=Jx$ and isometry yields $\|x_n-x\|=\|Jx_n-Jx\|\to0$. Conversely, $c_0$ is complete in sup norm, but its image in $\ell^\infty$ omits the constant sequence one. This counterexample uses the canonical identifications, not dimension counting.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u05-ex4: Proof portfolio: real and complex Hahn–Banach

Prompt: Prove the norm-preserving Hahn–Banach theorem: if $M$ is a linear subspace of a real or complex normed space $X$ and $f\in M^*$, there is $F\in X^*$ with $F|_M=f$ and $\|F\|=\|f\|$. Do not assume $M$ is closed or $X$ complete. You may use Zorn's lemma, but not Hahn–Banach itself.

1. In the real case set $C=\|f\|$ and take $x_0\notin M$. Derive the interval of allowable values for $a=F(x_0)$ in $F(m+tx_0)=f(m)+ta$. Prove its lower endpoint is at most its upper endpoint and both are finite. Check all signs of $t$, including zero, and recover the two-sided absolute bound.
2. Define the partial order of extensions, prove that every chain has a compatible linear upper bound with the same estimate, and use maximality to obtain an extension on all of $X$.
3. In a complex space apply the real result to $\operatorname{Re}f$ and construct a complex-linear extension from the resulting real-linear map $g$. Verify both complex linearity and extension of the imaginary part. Use a unit complex phase to obtain the sharp bound rather than a larger constant.
4. Prove equality of norms, including the case $f=0$. Deduce the norming-functional formula $\|x\|=\sup_{\|\varphi\|\le1}|\varphi(x)|$ and the isometry of the canonical map $J:X\to X^{**}$. Explain separately why completeness is irrelevant to extension but relevant to the closedness of $J(X)$.

Instructor reference: `content/courses/MAT-230/units/05-hahn-banach-and-the-double-dual/instructor/MAT-230-u05-ex4.reference-solution.md`.

# Proof portfolio: real and complex Hahn–Banach — reference reasoning

## 1. One additional real direction

Put $C=\|f\|\ge0$. Since $x_0\notin M$, the representation $m+tx_0$ is unique, so the proposed formula defines a linear map once $a$ is chosen. To obtain $F(v)\le C\|v\|$, evaluating at $m-x_0$ and $n+x_0$ gives respectively
$$f(m)-C\|m-x_0\|\le a\le C\|n+x_0\|-f(n).$$
For arbitrary $m,n\in M$,
$$f(m)+f(n)=f(m+n)\le C\|m+n\|\le C\|m-x_0\|+C\|n+x_0\|.$$
Thus every candidate lower bound is at most every candidate upper bound. Let $L$ be the supremum of the lower bounds and $U$ the infimum of the upper bounds. Taking $m=0$ gives a lower candidate $-C\|x_0\|$; taking $n=0$ gives an upper candidate $C\|x_0\|$. The pairwise inequality therefore proves $-C\|x_0\|\le L\le U\le C\|x_0\|$, so choose $a\in[L,U]$.

If $t>0$, apply the upper inequality with $n=m/t$ and multiply by $t$ to obtain $f(m)+ta\le C\|m+tx_0\|$. If $t<0$, write $t=-s$, $s>0$, and use the lower inequality with $m/s$ to obtain $f(m)-sa\le C\|m-sx_0\|$. For $t=0$ the original bound applies. Finally apply this upper bound to $-v$ and use linearity to get $-C\|v\|\le F(v)\le C\|v\|$. This proof also works when $C=0$: the interval consists of zero.

## 2. Maximal compatible extension

Take the set of all pairs $(N,h)$ with $M\subset N\subset X$ a real subspace, $h|_M=f$, and $|h(v)|\le C\|v\|$ on $N$. It is nonempty. Order pairs by extension of both domain and values. For a chain, let $N$ be the union of its domains. Any finitely many vectors lie in one domain in the chain, so $N$ is a subspace and the compatible union map is well-defined and linear. The bound holds at each vector in whichever domain contains it. This pair is a chain upper bound. Zorn supplies a maximal pair. If its domain were proper, the one-dimensional extension just proved would strictly enlarge it, a contradiction. We obtain a real-linear bounded extension on $X$ with norm at most $C$. No limit in $X$ or closure of $M$ was used.

## 3. Complexification and the sharp estimate

Regard the complex spaces as real spaces and extend $u=\operatorname{Re}f$ using the real theorem with bound $C$; this gives a real-linear $g:X\to\mathbb R$ with $g|_M=u$ and $|g(x)|\le C\|x\|$. Define
$$F(x)=g(x)-ig(ix).$$
It is real-linear, and $F(ix)=g(ix)-ig(-x)=g(ix)+ig(x)=iF(x)$. Consequently it is complex-linear. On $M$, $g(x)=\operatorname{Re}f(x)$ and $g(ix)=\operatorname{Re}(if(x))=-\operatorname{Im}f(x)$, so $F(x)=f(x)$, including its imaginary part.

If $F(x)\ne0$, choose $|\lambda|=1$ with $\lambda F(x)=|F(x)|$. Complex linearity and $\operatorname{Re}F(y)=g(y)$ give
$$|F(x)|=\operatorname{Re}F(\lambda x)=g(\lambda x)\le C\|\lambda x\|=C\|x\|.$$
The case $F(x)=0$ is immediate. This avoids the nonsharp estimate obtained by adding separate real and imaginary bounds.

## 4. Norm, norming functionals and bidual

Restriction gives $\|f\|\le\|F\|$, whereas construction gives $\|F\|\le C=\|f\|$. Thus equality holds. If $f=0$, the zero map is an extension and the construction's bound also forces it to be zero.

For a nonzero $x$, on its real or complex one-dimensional span define $h(\alpha x)=\alpha\|x\|$. This has norm one. Extend it to $\varphi$ of norm one; then $\varphi(x)=\|x\|$. Every functional of norm at most one has $|\varphi(x)|\le\|x\|$, proving the supremum formula (also at $x=0$). The canonical $Jx$, defined by $(Jx)(\varphi)=\varphi(x)$, is a bounded linear functional on $X^*$, and that formula says $\|Jx\|=\|x\|$. Thus $J$ is a linear isometry. If $X$ is complete, a convergent sequence in $J(X)$ pulls back to a Cauchy sequence in $X$ and has its limit there, so $J(X)$ is closed. Extension and the isometry required no completeness. In fact if $J(X)$ is closed in the Banach space $X^{**}$, the isometry also implies $X$ is complete. Neither closedness nor completeness by itself says $J$ is onto.

## Marking boundary

This is one complete route, not an exhaustive template. Accept a correct alternative proof with every named obligation met. Quoting the theorem being proved is not evidence for its proof; previously established lemmas may be used when the prompt allows them. Track assistance and the first substantive gap. Author self-review has not been substituted for independent academic review.

### MAT-230-u06 — Outer measure, σ-algebras and Lebesgue measure

Objectives: Construct Lebesgue outer measure and explain the Carathéodory criterion.; Prove measurability of null sets and distinguish countable additivity from subadditivity.; Apply continuity of measure and identify when the finite-measure hypothesis is indispensable.; Synthesize units1–6 in the explicit mid-course portfolio: quotient completeness, bounded inverse, dual separation, uniform boundedness, and the distinction between category and measure.

#### MAT-230-u06-ex1: A cover with an adjustable budget

Prompt: Let $A\subset\mathbb R$ be countable. Prove that for every $\varepsilon>0$ it lies in an open set $O$ with $m(O)<\varepsilon$. Does the same conclusion hold for every set with outer measure zero? Explain using the definition, not a named regularity theorem.

Instructor reference: `content/courses/MAT-230/units/06-outer-measure-and-sigma-algebras/instructor/MAT-230-u06-ex1.reference-solution.md`.

# A cover with an adjustable budget — reference reasoning

Enumerate $A=\{a_1,a_2,\ldots\}$ and cover $a_j$ by an open interval of length $\varepsilon2^{-j-1}$. Their union is open and its measure is at most the sum, namely $\varepsilon/2<\varepsilon$. A finite or empty set is even simpler. If $m^*(A)=0$, the infimum defining outer measure supplies a countable open interval cover whose total length is below $\varepsilon$. The union is Borel and hence measurable; countable subadditivity bounds its measure. The two arguments differ only in how the cover is found.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u06-ex2: Only finitely many visits, almost everywhere

Prompt: For measurable sets $E_n\subset\mathbb R$, suppose $\sum_nm(E_n)<\infty$. Show that the set of points belonging to infinitely many $E_n$ has measure zero. Give a sequence with $\sum_nm(E_n)=\infty$ for which this conclusion fails, and another for which it still holds.

Instructor reference: `content/courses/MAT-230/units/06-outer-measure-and-sigma-algebras/instructor/MAT-230-u06-ex2.reference-solution.md`.

# Only finitely many visits, almost everywhere — reference reasoning

The infinitely-often set is $L=\bigcap_{N\ge1}\bigcup_{n\ge N}E_n$, hence measurable. For each $N$, monotonicity and subadditivity give $m(L)\le\sum_{n\ge N}m(E_n)$, whose tail tends to zero. No independence assumption is needed. For failure take every $E_n=[0,1]$: the sum diverges and $L=[0,1]$. For divergence with the conclusion still true, take $E_n=[n,n+1]$; every real point belongs to at most two such sets, so $L=\varnothing$. Divergence alone gives no converse.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u06-ex3: Large topologically, small in measure

Prompt: Construct a dense open subset $O\subset[0,1]$ (open in the relative topology) with $m(O)<1/10$. Prove its complement is closed, has empty interior relative to $[0,1]$, and has positive measure. Explain why this does not contradict the Baire category theorem.

Instructor reference: `content/courses/MAT-230/units/06-outer-measure-and-sigma-algebras/instructor/MAT-230-u06-ex3.reference-solution.md`.

# Large topologically, small in measure — reference reasoning

Enumerate the rationals in $[0,1]$ and take relative open intervals around them with total lengths less than $1/10$. Their union $O$ is dense, relative open, and has measure below $1/10$. Its complement $F$ is relative closed and has no relative interior because $O$ is dense. By additivity inside the finite-measure interval, $m(F)=1-m(O)>9/10$. Thus a nowhere-dense closed set can have positive measure. Baire prohibits covering a complete metric space by countably many nowhere-dense closed sets; it does not assert that an individual nowhere-dense set has measure zero. Here the dense open complement is nonempty, so there is no such cover.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u06-ex4: Mid-course portfolio: completeness, category and separation

Prompt: This is the concrete mid-course assessment for units 1–6. Work over the real scalars. Let $X$ and $Z$ be Banach spaces, let $T:X\to Z$ be a bounded surjection, put $M=\ker T$, and let $Q:X\to Y=X/M$ be the quotient map. You may invoke the earlier theorems after stating and checking their hypotheses; the separate unit 5 portfolio assesses the Hahn–Banach proof itself.

1. Prove $M$ is closed, that the quotient distance is a norm, and that $Y$ is Banach. Include the representative-lifting/absolutely-summable-series argument, rather than just naming quotient completeness.
2. Prove $\overline T:Y\to Z$, $\overline T(Qx)=Tx$, is a bounded linear bijection with bounded inverse. Deduce a constant $C$ for which $\|Qx\|\le C\|Tx\|$. Explain why this gives a lift of every nonzero $z\in Z$ with norm at most $2C\|z\|$, but does not claim a norm-minimizing lift exists. Name where Baire enters the theorem being used.
3. Prove pullback by $Q$ identifies $Y^*$ isometrically with $M^\perp=\{\varphi\in X^*: \varphi|_M=0\}$. For $x\notin M$, use Hahn–Banach to produce $\varphi\in M^\perp$ with $\|\varphi\|=1$ and $\varphi(x)=\operatorname{dist}(x,M)$. State why closedness matters for this positive distance.
4. Suppose $(\varphi_n)\subset M^\perp$ is pointwise bounded on $X$. Descend the family to $Y$ and prove a uniform bound on its norms. Reconstruct the closed-set/Baire/interior-ball step. Contrast with $c_{00}$ and the family $x\mapsto nx_n$, where the completeness hypothesis fails.
5. On $[0,1]$ construct a relatively open dense set of measure less than $1/10$ by covering the rationals with intervals of summable lengths. Show its complement is closed, nowhere dense and has measure greater than $9/10$. Explain why this is consistent with Baire and why “small in category” is not interchangeable with “measure zero”.

Instructor reference: `content/courses/MAT-230/units/06-outer-measure-and-sigma-algebras/instructor/MAT-230-u06-ex4.reference-solution.md`.

# Mid-course portfolio: completeness, category and separation — reference reasoning

## 1. The quotient is a Banach space

Continuity of $T$ makes $M=T^{-1}(\{0\})$ a closed subspace. The quantity $\|Qx\|=\inf_{m\in M}\|x-m\|$ is independent of the representative. Homogeneity is obtained by scaling representatives, and the triangle inequality by choosing two representatives arbitrarily close to their infima and then adding them. If this infimum is zero, $x$ lies in the closure of $M$, hence in $M$; thus the quotient norm is definite. Also $\|Qx\|\le\|x\|$.

For an absolutely summable series $\sum y_j$ in this quotient norm, choose representatives $v_j$ with $Qv_j=y_j$ and $\|v_j\|\le2\|y_j\|$ when $y_j\ne0$, and zero for a zero term. The infimum need not be attained; a factor two is enough. Then $\sum\|v_j\|<\infty$, so $\sum v_j$ converges in Banach $X$. The contraction $Q$ carries its partial sums to a convergent sequence with terms $\sum_{j\le N}y_j$. The unit 2 absolutely-summable-series criterion proves $Y$ is Banach.

## 2. The induced inverse and approximate lifts

If $Qx=Qx'$, their difference belongs to $M=\ker T$, so $Tx=Tx'$ and $\overline T$ is well-defined. It is linear, injective by the kernel condition, and onto by surjectivity of $T$. For every $m\in M$,
$$\|\overline T(Qx)\|=\|T(x-m)\|\le\|T\|\,\|x-m\|.$$
Taking the infimum gives boundedness with norm at most $\|T\|$. Both $Y$ and $Z$ are Banach, so the bounded inverse theorem gives $\|Qx\|=\|\overline T^{-1}Tx\|\le C\|Tx\|$ for some $C>0$ (choose any positive $C$ if both spaces are zero). Baire enters the proof of the open mapping theorem, which supplies this bounded inverse; mere algebraic bijectivity would not suffice.

For nonzero $z$, let $y=\overline T^{-1}z\ne0$. Choose a representative $v$ with $Qv=y$ and $\|v\|\le2\|y\|\le2C\|z\|$. Then $Tv=z$. For $z=0$, take $v=0$. This uses approximation to an infimum and supplies a controlled lift, not an attained minimum.

## 3. The dual and geometric separation

For $\psi\in Y^*$, $Q^*\psi=\psi\circ Q$ annihilates $M$ and has norm at most $\|\psi\|$ because $Q$ is a contraction. Conversely, if $\varphi\in M^\perp$, define $\psi(Qx)=\varphi(x)$. This is well-defined and linear, and
$$|\psi(Qx)|=|\varphi(x-m)|\le\|\varphi\|\,\|x-m\|$$
for every $m\in M$. Hence $|\psi(Qx)|\le\|\varphi\|\|Qx\|$, so $\|\psi\|\le\|\varphi\|$. Together with the pullback bound this proves equality of norms and the isometric identification.

For $x\notin M$, $y=Qx$ is nonzero with $d=\|y\|=\operatorname{dist}(x,M)>0$. On the one-dimensional span of $y$ define $h(ty)=td$, of norm one. Hahn–Banach extends it to $\psi\in Y^*$ of norm one. Then $\varphi=Q^*\psi$ has norm one, annihilates $M$, and $\varphi(x)=d$. Closedness ensures a point outside $M$ is outside its closure and has positive quotient norm; without it the same statement can fail even for $x\notin M$.

## 4. Baire turns pointwise bounds into a uniform norm bound

Let $\psi_n$ be the descended functionals. At a fixed $y=Qx$, $\sup_n|\psi_n(y)|=\sup_n|\varphi_n(x)|<\infty$. Define
$$E_k=\{y\in Y:|\psi_n(y)|\le k\text{ for all }n\}.$$
These are closed and cover $Y$. Since $Y$ is complete, Baire gives some $E_k$ containing a ball $B(y_0,r)$. For $\|v\|<r$, both $y_0$ and $y_0+v$ belong to $E_k$, so $|\psi_n(v)|\le2k$ for every $n$. Scaling and taking a limit to the radius give $\|\psi_n\|\le2k/r$ for all $n$. The dual isometry gives the same uniform bound on $\|\varphi_n\|$. In the zero quotient the conclusion holds trivially as well.

On $c_{00}$ with the sup norm, a fixed vector has only finitely many nonzero coordinates, so $nx_n$ is bounded as $n$ varies. But the operator norm of $x\mapsto nx_n$ is $n$, by the upper bound and the test $e_n$. The domain is incomplete: finite truncations of $(1/n)$ converge uniformly outside $c_{00}$. Thus the Baire step cannot be used there.

## 5. Category and measure distinguish different behaviour

Enumerate the rational points of $[0,1]$ as $q_j$. For each $j\ge1$, choose an open interval centred at $q_j$ of length less than $2^{-j}/20$, and let $O$ be the union of those intervals intersected with $[0,1]$. It is relatively open and contains the dense rationals, hence is dense. Countable subadditivity of outer measure gives $m(O)<1/20<1/10$. Its complement $F$ is relatively closed and has empty relative interior because $O$ is dense, so $F$ is nowhere dense in $[0,1]$. Since $O$ is measurable, $m(F)=1-m(O)>19/20>9/10$.

Baire says a nonempty complete metric space cannot be a countable union of nowhere-dense closed sets; it does not say each nowhere-dense set must have zero measure. This large-measure $F$ is therefore consistent with Baire. Conversely the rational points are dense and null. The two notions track different properties, and neither can replace the other in the preceding norm/measure arguments.

## Marking boundary

This is one complete route, not an exhaustive template. Accept a correct alternative proof with every named obligation met. Quoting the theorem being proved is not evidence for its proof; previously established lemmas may be used when the prompt allows them. Track assistance and the first substantive gap. Author self-review has not been substituted for independent academic review.

### MAT-230-u07 — Measurable functions, simple functions and the integral

Objectives: Construct increasing simple approximations to a nonnegative measurable function.; Define the nonnegative Lebesgue integral independently of a chosen representation.; Use monotone convergence and Fatou's lemma, and diagnose invalid interchanges of limit and integral.

#### MAT-230-u07-ex1: An integral that ignores a dense set

Prompt: Enumerate $\mathbb Q\cap[0,1]=\{q_1,q_2,\ldots\}$ and let $f_n=1_{\{q_1,\ldots,q_n\}}$. Find the pointwise limit, prove measurability of the limit, and compute all integrals. Explain why the limit is not Riemann integrable although every $f_n$ is.

Instructor reference: `content/courses/MAT-230/units/07-measurable-functions-and-the-integral/instructor/MAT-230-u07-ex1.reference-solution.md`.

# An integral that ignores a dense set — reference reasoning

The functions increase pointwise to $1_{\mathbb Q\cap[0,1]}$. Finite sets and the countable union are Borel; all have measure zero, so all Lebesgue integrals are zero. Monotone convergence confirms this limit interchange. Each $f_n$ is Riemann integrable with integral zero: finitely many discontinuities can be isolated in intervals of arbitrarily small total length. The limit has value zero and one in every subinterval, so every lower Darboux sum is zero and every upper sum is one. The failure concerns Riemann integrability, not Lebesgue measurability.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u07-ex2: Exchange an infinite sum and integral

Prompt: For $x\in[0,1)$, set $s_N(x)=\sum_{k=1}^N x^{2k}$. Compute $\int_0^1\sum_{k\ge1}x^{2k}\,dx$ as an extended integral. Then replace $x^{2k}$ by $2^{-k}x^{2k}$ and show the resulting integral is finite. You need not evaluate the latter series in closed form.

Instructor reference: `content/courses/MAT-230/units/07-measurable-functions-and-the-integral/instructor/MAT-230-u07-ex2.reference-solution.md`.

# Exchange an infinite sum and integral — reference reasoning

All terms are measurable and nonnegative. Monotone convergence gives $\int\sum_{k\ge1}x^{2k}=\sum_{k\ge1}(2k+1)^{-1}=\infty$, since this is a tail of the odd harmonic series. The sum equals $x^2/(1-x^2)$ on $[0,1)$, consistent with a divergent integral near one. With weights $2^{-k}$ the same theorem gives $\sum_{k\ge1}2^{-k}/(2k+1)\le\sum_{k\ge1}2^{-k}=1$. No finite-integral assumption was needed to exchange the first sum; finiteness was a conclusion only in the second example.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u07-ex3: Find the missing hypothesis in Fatou

Prompt: On $(0,1)$ let $g_n=-n1_{(0,1/n)}$. Show that Fatou’s conclusion fails if its nonnegativity hypothesis is simply dropped. Prove the repaired statement for measurable $g_n\ge h$ where $h$ is a fixed integrable function.

Instructor reference: `content/courses/MAT-230/units/07-measurable-functions-and-the-integral/instructor/MAT-230-u07-ex3.reference-solution.md`.

# Find the missing hypothesis in Fatou — reference reasoning

For each $x>0$, eventually $x\ge1/n$, so $g_n(x)=0$; thus $\int\liminf g_n=0$. But $\int g_n=-1$, contradicting the proposed inequality $0\le-1$. If $g_n\ge h\in L^1$, then $g_n-h\ge0$. Fatou gives $\int(\liminf g_n-h)\le\liminf\int(g_n-h)$. Adding the finite value $\int h$ yields $\int\liminf g_n\le\liminf\int g_n$, interpreted in the extended sense with integrable negative parts. The fixed integrable lower bound prevents mass from concentrating with unbounded negative contribution.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

### MAT-230-u08 — Integrable functions, dominated convergence and L^p

Objectives: Apply dominated convergence with a genuine common integrable bound.; Use Hölder and Minkowski with their endpoint and finite-measure hypotheses.; Prove Lᵖ completeness from a summable subsequence and distinguish norm from pointwise convergence.

#### MAT-230-u08-ex1: Where a power belongs

Prompt: For $a>0$, determine exactly when $f(x)=x^{-a}$ belongs to $L^p(0,1)$ for $1\le p<\infty$, and whether it belongs to $L^\infty$. For $g(x)=x^{-a}$ on $(1,\infty)$, repeat the analysis. Use this to disprove a universal $L^2(\mathbb R)\subset L^1(\mathbb R)$ inclusion.

Instructor reference: `content/courses/MAT-230/units/08-integrable-functions-dominated-convergence-and-lp/instructor/MAT-230-u08-ex1.reference-solution.md`.

# Where a power belongs — reference reasoning

On $(0,1)$ the integral of $x^{-ap}$ is finite exactly when $ap<1$; the value is $1/(1-ap)$. At $ap=1$ the logarithm diverges. For every $a>0$ the essential supremum is infinite because a positive-measure interval near zero exceeds any finite bound. On $(1,\infty)$ integrability holds exactly when $ap>1$, with integral $1/(ap-1)$; the essential supremum is one. Extend $g(x)=x^{-3/4}$ by zero outside $(1,\infty)$. Its square is integrable but it is not integrable, disproving the inclusion on an infinite-measure domain.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u08-ex2: A precise spike taxonomy

Prompt: For $p\ge1$ and $\alpha>0$, put $f_n(x)=n^\alpha1_{(0,1/n)}(x)$ on $(0,1)$. Determine pointwise convergence and $L^p$ convergence to zero. When $\alpha p<1$, prove that these functions admit a common $L^p$ dominator. When $\alpha p\ge1$, show no such dominator exists.

Instructor reference: `content/courses/MAT-230/units/08-integrable-functions-dominated-convergence-and-lp/instructor/MAT-230-u08-ex2.reference-solution.md`.

# A precise spike taxonomy — reference reasoning

At any fixed $x>0$ the indicator eventually vanishes. The norm is $n^{\alpha-1/p}$, so convergence to zero occurs precisely when $\alpha p<1$; at equality the norm is one and above it diverges. If $x<1/n$, then $n^\alpha<x^{-\alpha}$, so $g(x)=x^{-\alpha}$ dominates all terms and $g\in L^p$ precisely in the first regime. If a common $L^p$ dominator existed in either other regime, dominated convergence applied to $|f_n|^p$ would force norms to zero, contradicting the explicit formula. This necessity uses the theorem, not just failure of the guessed dominator.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u08-ex3: Convergence with the quantifiers changed

Prompt: Enumerate the dyadic half-open intervals of $[0,1)$ level by level: at level $k$ use $[j2^{-k},(j+1)2^{-k})$, $j=0,\ldots,2^k-1$. Let $(h_n)$ be their indicators in that order. Prove $h_n\to0$ in every finite $L^p$, but $h_n(x)$ fails to converge for every $x\in[0,1)$. Explain why the subsequence consequence of Lᵖ convergence is not contradicted.

Instructor reference: `content/courses/MAT-230/units/08-integrable-functions-dominated-convergence-and-lp/instructor/MAT-230-u08-ex3.reference-solution.md`.

# Convergence with the quantifiers changed — reference reasoning

Every interval at level $k$ has length $2^{-k}$, so the norm of its indicator is $2^{-k/p}\to0$ as the enumeration advances. For each fixed $x$, exactly one interval per level contains it, hence infinitely many terms equal one. For every level $k\ge1$ at least one other interval misses it, hence infinitely many terms equal zero. Thus no pointwise limit exists anywhere in $[0,1)$. The theorem only promises a subsequence. For example, the indicators of $[0,2^{-k})$ converge to zero at all $x>0$ and fail to do so only at zero, a null set. Half-open endpoints remove ambiguity in the “exactly one” assertion.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u08-ex4: Proof portfolio: completeness of every Lp space

Prompt: Let $(E,\Sigma,\mu)$ be a measure space, and let $L^p$ mean measurable real or complex functions modulo equality almost everywhere. Prove $L^p(E)$ is Banach for every $1\le p\le\infty$. You may use the measure/integral construction, monotone convergence, Hölder and Minkowski already proved in the course, but may not quote completeness of $L^p$.

1. For $1\le p<\infty$, start with an arbitrary $L^p$-Cauchy sequence and choose a subsequence $(f_{n_k})$ whose successive norm differences are at most $2^{-k}$. With measurable representatives, control the partial sums of the absolute differences by Minkowski and pass to their nonnegative limit with monotone convergence.
2. Prove the resulting series converges absolutely almost everywhere. Construct a measurable limit in $L^p$, bound its difference from $f_{n_k}$ by the tail series, and prove norm convergence. Recover convergence of the whole original Cauchy sequence.
3. Give a separate proof for $p=\infty$: remove one common null set for all representatives and all pairwise essential-norm estimates, obtain a uniform Cauchy sequence there, and prove its limit represents an essentially bounded function with convergence in essential-supremum norm.
4. Identify exactly where countability, equivalence classes, and completeness of the scalar field enter. Explain why neither finite measure of $E$ nor pointwise convergence of the whole sequence for finite $p$ is required.

Instructor reference: `content/courses/MAT-230/units/08-integrable-functions-dominated-convergence-and-lp/instructor/MAT-230-u08-ex4.reference-solution.md`.

# Proof portfolio: completeness of every Lp space — reference reasoning

## Finite exponents: summable differences

Fix $1\le p<\infty$. By the Cauchy property choose increasing indices $n_k$ such that $\|f_{n_{k+1}}-f_{n_k}\|_p\le2^{-k}$. Choose a measurable representative for each selected class and set $h_k=f_{n_{k+1}}-f_{n_k}$. For $g_N=\sum_{k=1}^N|h_k|$, finite Minkowski gives
$$\|g_N\|_p\le\sum_{k=1}^N\|h_k\|_p\le1.$$
The functions $g_N^p$ increase to $g^p$, where $g=\sum_{k=1}^\infty|h_k|$ is a measurable extended nonnegative function. Monotone convergence yields $\int g^p=\lim_N\int g_N^p\le1$. Hence $g$ is finite almost everywhere: for example $\mu(\{g>R\})\le R^{-p}\int g^p$, so $\{g=\infty\}$ is null. This argument does not require the whole measure space to have finite measure.

At each point where $g$ is finite and the representatives have finite values, the scalar series $\sum h_k$ is absolutely convergent in $\mathbb R$ or $\mathbb C$, hence converges. Put $f=f_{n_1}+\sum h_k$ there and set $f=0$ on the exceptional measurable null set. Partial sums are measurable, so this defines a measurable representative. The bound $|f|\le|f_{n_1}|+g$ almost everywhere and Minkowski imply $f\in L^p$.

For each $k$, define $G_k=\sum_{j=k}^\infty|h_j|$. Apply Minkowski to its finite partial sums and monotone convergence to their $p$ th powers:
$$\|G_k\|_p\le\sum_{j=k}^\infty2^{-j}=2^{1-k}.$$
Telescoping gives $|f-f_{n_k}|\le G_k$ almost everywhere, so $\|f-f_{n_k}\|_p\le2^{1-k}\to0$. Given $\varepsilon>0$, choose a Cauchy threshold $N$ and then $k$ with $n_k\ge N$ and $\|f-f_{n_k}\|_p<\varepsilon/2$. For every $n\ge N$, the triangle inequality gives $\|f_n-f\|_p\le\|f_n-f_{n_k}\|_p+\|f_{n_k}-f\|_p<\varepsilon$, using a Cauchy bound $\varepsilon/2$. Thus the full sequence converges in norm. We have proved almost-everywhere convergence only for the chosen subsequence; the typewriter example shows why no stronger pointwise conclusion follows for the full sequence.

## The endpoint p=infinity

Choose measurable representatives of all $f_n$. For each $n$, the estimate $|f_n(x)|\le\|f_n\|_\infty$ holds off a null set, and for each pair $(n,m)$ the estimate
$$|f_n(x)-f_m(x)|\le\|f_n-f_m\|_\infty$$
holds off a null set. The non-strict essential bound itself follows by intersecting the almost-everywhere bounds with errors $1/j$ if necessary. Remove the union of these countably many null sets; call the remaining full-measure set $E_0$. All representatives and all pairwise estimates now hold simultaneously on $E_0$.

The norm-Cauchy condition implies the functions form a uniformly Cauchy sequence on $E_0$. Scalar completeness supplies a pointwise limit $f$ there. For every $\varepsilon>0$, if $n,m\ge N$ the pairwise bound is below $\varepsilon$ uniformly on $E_0$; letting $m\to\infty$ gives $|f_n-f|\le\varepsilon$ on $E_0$ for $n\ge N$. Set $f=0$ on its null complement. Pointwise limits and this measurable modification give a measurable function. Fix one sufficiently large $n_0$ with $|f-f_{n_0}|\le1$ on $E_0$. Then $|f|\le1+\|f_{n_0}\|_\infty$ there, so $f$ is essentially bounded. The uniform estimates on $E_0$ give $\|f_n-f\|_\infty\to0$.

## What the proof establishes

Countability permits a single null-set exclusion and the use of sequences and countable sums. Equivalence classes ensure that changing representatives on null sets leaves all norm conclusions unchanged and that zero norm means the zero element. Scalar completeness gives the pointwise sum or limit; completeness of the function space was proved, never assumed. The $p=\infty$ proof is an essential-uniform argument, not an application of dominated convergence. No finite-measure hypothesis or preferred everywhere-defined pointwise representative was required. Since the earlier inequalities establish normed linear spaces and we have shown every norm-Cauchy sequence converges in them, they are Banach spaces.

## Marking boundary

This is one complete route, not an exhaustive template. Accept a correct alternative proof with every named obligation met. Quoting the theorem being proved is not evidence for its proof; previously established lemmas may be used when the prompt allows them. Track assistance and the first substantive gap. Author self-review has not been substituted for independent academic review.

### MAT-230-u09 — Hilbert spaces, orthonormal bases and Fourier series

Objectives: Derive Bessel's inequality and Parseval's identity, stating the completeness condition on the orthonormal family.; Compute finite-dimensional best approximations and interpret L² Fourier convergence.; Explain the role of Fejér means in proving trigonometric completeness without asserting pointwise convergence of ordinary Fourier sums.

#### MAT-230-u09-ex1: Least-squares approximation with a check

Prompt: In real $L^2(0,1)$ find the affine function nearest to $x^2$. Compute the exact squared error and verify orthogonality of the residual to both $1$ and $x$.

Instructor reference: `content/courses/MAT-230/units/09-hilbert-spaces-and-orthonormal-bases/instructor/MAT-230-u09-ex1.reference-solution.md`.

# Least-squares approximation with a check — reference reasoning

The lecture gives candidate $p(x)=x-1/6$. Directly, $\int_0^1(x^2-x+1/6)\,dx=1/3-1/2+1/6=0$ and $\int_0^1x(x^2-x+1/6)\,dx=1/4-1/3+1/12=0$. Hence the residual is orthogonal to every affine function. Expanding the square or using $\|x^2\|^2-\|p\|^2$ gives $1/5-(1/3-1/6+1/36)=1/180$. For any other affine $q$, Pythagoras gives $\|x^2-q\|^2=1/180+\|p-q\|^2$, proving uniqueness. A best-fit plot alone would not establish this identity.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u09-ex2: An orthonormal family can miss half the space

Prompt: In $\ell^2(\mathbb N)$ retain only $e_2,e_4,e_6,\ldots$. Describe their closed span and orthogonal complement. Compute the limit of the associated projections of an arbitrary $x$. Give a nonzero vector for which all the retained coefficients vanish and explain why Parseval fails for this family.

Instructor reference: `content/courses/MAT-230/units/09-hilbert-spaces-and-orthonormal-bases/instructor/MAT-230-u09-ex2.reference-solution.md`.

# An orthonormal family can miss half the space — reference reasoning

Their closed span is the closed subspace of sequences with odd coordinates zero: truncations prove inclusion of all such sequences and coordinate continuity proves closedness. The orthogonal complement consists of sequences with even coordinates zero. The projections converge to $(0,x_2,0,x_4,\ldots)$, since the discarded even tail is square-summable. The vector $e_1$ is nonzero and all retained coefficients vanish. Bessel remains valid, but equality is missing the squared norm of the odd-coordinate component. Orthonormality alone is therefore insufficient for Parseval.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u09-ex3: Recover a classical series by Parseval

Prompt: For $f(x)=x$ on $(-\pi,\pi)$, compute its real sine coefficients and use Parseval to obtain $\sum_{n\ge1}n^{-2}$. Specify the norm and normalisation and explain why no assertion of uniform Fourier convergence is needed.

Instructor reference: `content/courses/MAT-230/units/09-hilbert-spaces-and-orthonormal-bases/instructor/MAT-230-u09-ex3.reference-solution.md`.

# Recover a classical series by Parseval — reference reasoning

With real Fourier convention $b_n=\pi^{-1}\int_{-\pi}^{\pi}x\sin(nx)\,dx$, integration by parts gives $b_n=2(-1)^{n+1}/n$; all cosine coefficients and the mean vanish by oddness. In the orthogonal real system, $\|\sin nx\|_2^2=\pi$, so Parseval gives $\int_{-\pi}^{\pi}x^2\,dx=\pi\sum b_n^2$. The left side is $2\pi^3/3$, hence $2\pi^3/3=4\pi\sum n^{-2}$ and the sum is $\pi^2/6$. The argument uses completeness in $L^2$ and a norm identity. Uniform convergence across the periodic endpoint jump is neither asserted nor required.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

### MAT-230-u10 — Riesz representation and adjoints

Objectives: Prove existence and orthogonality of projection onto a closed Hilbert subspace.; Represent bounded linear functionals by inner products with the correct complex convention.; Compute adjoints and relate kernel, range and their closures.

#### MAT-230-u10-ex1: A minimum-norm solution

Prompt: In real $\ell^2$ minimise $\|x\|_2$ subject to $\sum_{n\ge1}2^{-n}x_n=1$. Prove existence, uniqueness, and the exact minimum without a finite-dimensional truncation argument.

Instructor reference: `content/courses/MAT-230/units/10-riesz-representation-and-adjoints/instructor/MAT-230-u10-ex1.reference-solution.md`.

# A minimum-norm solution — reference reasoning

Let $a=(2^{-n})_{n\ge1}$, so $\|a\|^2=\sum4^{-n}=1/3$. The constraint is $\langle x,a\rangle=1$. Cauchy–Schwarz forces $\|x\|\ge1/\|a\|=\sqrt3$. Equality is achieved by $x=a/\|a\|^2=3a$. Every other admissible vector is $3a+z$ with $z\perp a$, and Pythagoras gives $\|x\|^2=3+\|z\|^2$, proving uniqueness. The infinite series defining the constraint converges by Cauchy–Schwarz, so it is a legitimate continuous affine constraint.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u10-ex2: An adjoint is not always an inverse

Prompt: For the unilateral right shift $S$ on complex $\ell^2$, verify $S^*$ directly from the inner product. Determine the kernels and ranges of both operators, and check $\overline{\operatorname{ran}S}=(\ker S^*)^\perp$.

Instructor reference: `content/courses/MAT-230/units/10-riesz-representation-and-adjoints/instructor/MAT-230-u10-ex2.reference-solution.md`.

# An adjoint is not always an inverse — reference reasoning

With $\langle x,y\rangle=\sum x_n\overline{y_n}$, $\langle Sx,y\rangle=\sum_{n\ge1}x_n\overline{y_{n+1}}$, giving the left shift as adjoint. The right shift has zero kernel and range $\{y:y_1=0\}$, a closed subspace. The left shift has kernel $\operatorname{span}\{e_1\}$ and is surjective because $S^*(0,y_1,y_2,\ldots)=y$. The orthogonal complement of its kernel is exactly the right-shift range. Finally $S^*S=I$ but $SS^*=I-P_{e_1}$, so only one inverse identity holds.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u10-ex3: The range that needs a closure

Prompt: Let $D:\ell^2\to\ell^2$ be $(Dx)_n=x_n/n$. Show $D=D^*$, its kernel is zero, and its range is dense but not closed. Give an explicit vector in its range closure but outside its range and an approximating sequence in the range.

Instructor reference: `content/courses/MAT-230/units/10-riesz-representation-and-adjoints/instructor/MAT-230-u10-ex3.reference-solution.md`.

# The range that needs a closure — reference reasoning

The real diagonal entries imply self-adjointness by the inner-product identity, and all entries are nonzero so the kernel is zero. Every finitely supported sequence is in the range (multiply its nth coordinate by n), proving density. The vector $y=(1/n)$ belongs to $\ell^2$ but a preimage would be $(1,1,\ldots)$, not in $\ell^2$. Its finite truncations $y^{(N)}$ lie in the range and converge in norm to $y$, so the range is not closed. Thus $\overline{\operatorname{ran}D}=\ell^2=(\ker D^*)^\perp$, whereas the unclosed range is smaller.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

### MAT-230-u11 — Compact operators and the spectrum

Objectives: Characterise compact diagonal operators and explain approximation by finite rank in Hilbert space.; Use the Neumann series to bound the resolvent and prove invertibility is an open condition.; Distinguish spectrum from eigenvalues by constructing an approximate eigenvector sequence.

#### MAT-230-u11-ex1: Invertibility survives a controlled perturbation

Prompt: Let $A$ be invertible and $\|A^{-1}\|\|E\|<1$. Prove $A+E$ is invertible and derive bounds for $\|(A+E)^{-1}\|$ and $\|(A+E)^{-1}-A^{-1}\|$.

Instructor reference: `content/courses/MAT-230/units/11-compact-operators-and-the-spectrum/instructor/MAT-230-u11-ex1.reference-solution.md`.

# Invertibility survives a controlled perturbation — reference reasoning

Factor $A+E=A(I+A^{-1}E)$ and apply the Neumann series to $-A^{-1}E$. This gives $\|(A+E)^{-1}\|\le\|A^{-1}\|/(1-\|A^{-1}\|\|E\|)$. The resolvent identity $(A+E)^{-1}-A^{-1}=-(A+E)^{-1}EA^{-1}$ then bounds the difference by $\|A^{-1}\|^2\|E\|/(1-\|A^{-1}\|\|E\|)$. The order of factors matters for noncommuting operators; each displayed identity can be checked by multiplication.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u11-ex2: Which diagonal is compact?

Prompt: On $\ell^2$ consider $A e_n=(-1)^n n^{-1/2}e_n$ and $B e_n=(1+n^{-1})e_n$. Decide compactness of each and compute each spectrum. For every spectral point say whether it is an eigenvalue.

Instructor reference: `content/courses/MAT-230/units/11-compact-operators-and-the-spectrum/instructor/MAT-230-u11-ex2.reference-solution.md`.

# Which diagonal is compact? — reference reasoning

A is compact because its diagonal tends to zero, and its spectrum is the closed set $\{(-1)^nn^{-1/2}:n\ge1\}\cup\{0\}$. Each displayed nonzero value is an eigenvalue, while zero is not because no diagonal entry vanishes; zero is witnessed by approximate eigenvectors e_n. B is not compact because its diagonal stays above one and images of basis vectors remain separated. Its spectrum is $\{1+1/n:n\ge1\}\cup\{1\}$. Each 1+1/n is an eigenvalue, but one is not. Away from each closed set, reciprocal diagonal entries are uniformly bounded, giving an actual bounded inverse. This last argument establishes there are no additional spectral points.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u11-ex3: Strong convergence is not norm convergence

Prompt: Let $P_N$ be projection onto the first N coordinates of $\ell^2$. Show $P_Nx\to x$ for every x but $\|P_N-I\|=1$. Prove the identity is not compact. Explain why finite-rank approximation in operator norm, not merely pointwise convergence, is the correct compactness criterion.

Instructor reference: `content/courses/MAT-230/units/11-compact-operators-and-the-spectrum/instructor/MAT-230-u11-ex3.reference-solution.md`.

# Strong convergence is not norm convergence — reference reasoning

Square-summability gives $\|x-P_Nx\|^2=\sum_{n>N}|x_n|^2\to0$ for each fixed x. Since I−P_N is an orthogonal projection its norm is at most one, and testing e_{N+1} gives equality. The identity sends the bounded sequence e_n to itself; pairwise distances are √2, so no subsequence converges. The pointwise convergence allows N to depend on x; operator norm requires one N controlling every unit vector. Only the latter allows finite nets for one finite-dimensional image to approximate the whole image uniformly.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

### MAT-230-u12 — The spectral theorem and the Dirichlet problem

Objectives: State the compact self-adjoint spectral theorem including the kernel and range closure.; Derive and check the Dirichlet Green operator, its eigenvalues and a norm error estimate.; Use spectral positivity to solve a variable-potential boundary problem and diagnose resonance when positivity is lost.

#### MAT-230-u12-ex1: A spectral approximation with an error bar

Prompt: For $f\in L^2(0,1)$ let $u=Gf$ and $u_N=\sum_{n=1}^N f_n(n\pi)^{-2}e_n$. Prove $\|u-u_N\|_2\le((N+1)\pi)^{-2}\|f\|_2$ and show the constant is sharp. For f=1 compute f_n, identify the exact classical solution, and explain why these two constructions agree.

Instructor reference: `content/courses/MAT-230/units/12-the-spectral-theorem-and-the-dirichlet-problem/instructor/MAT-230-u12-ex1.reference-solution.md`.

# A spectral approximation with an error bar — reference reasoning

Parseval gives $\|u-u_N\|_2^2=\sum_{n>N}|f_n|^2/(n\pi)^4\le((N+1)\pi)^{-4}\|f\|_2^2$. Equality is achieved by f=e_{N+1}, so the norm bound is sharp. For f=1, integration gives $f_n=\sqrt2(1-(-1)^n)/(n\pi)$, zero for even n and $2\sqrt2/(n\pi)$ for odd n. Directly solving −u''=1 with zero endpoints gives u=x(1−x)/2. Both are Gf: the integral formula establishes the classical solution and the complete sine expansion identifies its L² coefficients uniquely. No unsupported interchange of second derivatives and infinite sums is needed.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u12-ex2: Resonance and a failed uniqueness claim

Prompt: Assume $f\in L^2(0,1)$ and $\alpha\in\mathbb R$. Solve the compatibility question for $-u''-\alpha u=f$, u(0)=u(1)=0. State when there is a unique L² spectral solution, what condition is necessary and sufficient when α=(kπ)², and the family of solutions in that case. For f=e_k decide solvability at resonance. Here a spectral solution is required to belong to the Dirichlet operator domain: in the sine basis its coefficients satisfy $\sum_n(n\pi)^4|u_n|^2<\infty$. If $f$ is continuous, also explain why the solution is classical ($C^2$ with zero endpoint values).

Instructor reference: `content/courses/MAT-230/units/12-the-spectral-theorem-and-the-dirichlet-problem/instructor/MAT-230-u12-ex2.reference-solution.md`.

# Resonance and a failed uniqueness claim — reference reasoning

The sine coefficients satisfy $((n\pi)^2-\alpha)u_n=f_n$. If α is not one of the positive Dirichlet eigenvalues, the reciprocal multipliers are bounded and decay like n^{-2}, giving a unique spectral solution; continuous f gives a classical one by the Green equation. At α=(kπ)² compatibility requires f_k=0. If it holds, set u_n=f_n/((nπ)²−(kπ)²) for n≠k and choose u_k arbitrarily; this gives all solutions. If f=e_k then f_k=1, so no solution exists. Necessity can also be checked by integrating against e_k and integrating by parts. The nonnegative-potential hypothesis in the previous theorem prevented precisely this kind of zero mode.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.


For the declared forcing space, $f_n$ is square summable. Away from the resonant coordinate the ratios $(n\pi)^2/((n\pi)^2-\alpha)$ are uniformly bounded, since they tend to one and only finitely many low indices remain. Therefore $\sum_n(n\pi)^4|u_n|^2<\infty$; an arbitrary finite resonant coordinate does not change this. This proves membership in the stated Dirichlet operator domain, rather than just formal solvability. If $f$ is continuous, the same coefficient estimate and Cauchy–Schwarz imply uniform convergence of $u$'s sine series (use $\sum n^{-4}<\infty$), so $u$ is continuous and vanishes at the endpoints. The equation gives $u=G(f+\alpha u)$ in $L^2$ and then pointwise for the continuous representatives. The Green formula makes $u\in C^2$ and proves the classical equation.

#### MAT-230-u12-ex3: Cumulative proof: from operators back to a boundary problem

Prompt: Let V≥0 be continuous and f continuous on [0,1]. Reconstruct the G^{1/2} argument in the lesson, proving (i) S is compact, self-adjoint and nonnegative; (ii) I+S has an inverse of norm at most one; (iii) the resulting u is C² and satisfies the equation and boundary conditions; (iv) uniqueness. Identify the roles of completeness, Fourier completeness, compactness, and positivity.

Instructor reference: `content/courses/MAT-230/units/12-the-spectral-theorem-and-the-dirichlet-problem/instructor/MAT-230-u12-ex3.reference-solution.md`.

# Cumulative proof: from operators back to a boundary problem — reference reasoning

The diagonal G^{1/2} is bounded compact and self-adjoint because the real diagonal (nπ)^{-1} tends to zero. M_V is bounded self-adjoint, and composition with compact operators is compact. Thus S is compact self-adjoint; its quadratic form is the integral V|G^{1/2}w|²≥0. By the compact self-adjoint theorem all its eigenvalues are nonnegative, including the kernel eigenvalue zero. Define the inverse of I+S on an orthonormal eigenbasis by multipliers 1/(1+λ), bounded by one; completeness makes the resulting series an operator on all H. Set w and u as stated. The coefficient bound $\sum |w_n|/(n\pi)\le\|w\|_2(\sum(n\pi)^{-2})^{1/2}$ and |e_n|≤√2 give uniform convergence, continuous u and zero endpoint values. The operator identity yields u=G(f−Vu); its input is continuous, so the differentiated integral formula proves C² regularity and the ODE. For uniqueness subtract solutions, integrate against the conjugate and use nonnegativity of both energy terms. Completeness supports the series, Fourier completeness ensures no missing modes, compactness supplies the discrete spectral theorem for S, and positivity keeps −1 out of its spectrum. These roles must be stated, not merely named.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-230-u12-ex4: Final proof portfolio: compact self-adjoint spectral theorem

Prompt: Let $H$ be a separable complex Hilbert space, with inner product linear in the first argument, and let $K:H\to H$ be compact and self-adjoint. Prove the compact self-adjoint spectral theorem and connect it to the boundary-value construction. You may use the earlier Hilbert projection, Bessel and orthonormal-basis results, compactness, and the bounded-operator norm rules. You may not quote the spectral theorem or the extremal-eigenvector lemma as a black box. The precise assigned source proofs remain MIT Lectures 21–22; this portfolio requires you to reconstruct the following steps.

1. Prove for every bounded self-adjoint $T$ that $\|T\|=\sup_{\|x\|=1}|\langle Tx,x\rangle|$. Use a quadratic-form polarization estimate, with the complex convention checked.
2. If $K\ne0$, prove it has a unit eigenvector whose eigenvalue is either $\|K\|$ or $-\|K\|$. Start with a maximizing quadratic-form sequence, estimate $\|Kx_j-\lambda x_j\|$, and use compactness to obtain a norm limit of $x_j$; do not assume the unit sphere itself is compact.
3. Prove reality of eigenvalues, orthogonality of distinct eigenspaces, and finite multiplicity of every nonzero eigenvalue. Repeatedly restrict to invariant orthogonal complements to construct a finite or countable list $(e_j,\lambda_j)$ of nonzero eigenvectors. If the list is infinite, prove $\lambda_j\to0$ and $|\lambda_j|$ is nonincreasing.
4. Prove $\overline{\operatorname{span}}\{e_j\}=(\ker K)^\perp$, include the possible kernel, and establish $Kx=\sum_j\lambda_j\langle x,e_j\rangle e_j$ in norm. Prove the sharp truncation error $\|K-K_N\|=|\lambda_{N+1}|$ whenever a next eigenvector exists, and handle finite rank and $K=0$.
5. Prove all nonzero spectral values are precisely the listed eigenvalues by constructing the inverse for a nonzero complex number outside the list. Explain when zero belongs to the spectrum in finite and infinite dimensions, and why zero need not be an eigenvalue in infinite dimensions.
6. Apply the proved theorem to $S=G^{1/2}M_VG^{1/2}$ in the Dirichlet construction, with continuous real $V\ge0$. Prove $I+S$ is invertible with inverse norm at most one, including its action on $\ker S$. Identify which additional regularity argument from the other final problems is still needed to obtain a classical differential-equation solution. Distinguish that analytic bridge from the spectral theorem itself.

Instructor reference: `content/courses/MAT-230/units/12-the-spectral-theorem-and-the-dirichlet-problem/instructor/MAT-230-u12-ex4.reference-solution.md`.

# Final proof portfolio: compact self-adjoint spectral theorem — reference reasoning

## 1. The quadratic form determines the norm

For a bounded self-adjoint $T$, $q(x)=\langle Tx,x\rangle$ is real. Let $m=\sup_{\|x\|=1}|q(x)|\le\|T\|$. Homogeneity gives $|q(v)|\le m\|v\|^2$ for every $v$. Self-adjointness gives the real-part polarization identity
$$q(x+y)-q(x-y)=4\operatorname{Re}\langle Tx,y\rangle.$$
For unit $x,y$, the parallelogram identity implies
$$|\operatorname{Re}\langle Tx,y\rangle|\le\frac m4(\|x+y\|^2+\|x-y\|^2)=m.$$
If $Tx\ne0$, choose the unit vector $y=Tx/\|Tx\|$. Then $\langle Tx,y\rangle=\|Tx\|$ is real and positive, so $\|Tx\|\le m$. The zero case is immediate. Taking the supremum over unit $x$ proves $\|T\|=m$. This works in the complex space because the real part suffices for this particular choice of $y$.

## 2. Compactness produces an extremal eigenvector

Let $a=\|K\|>0$. Choose unit $x_j$ with $|q(x_j)|\to a$. Passing to a subsequence, there is a sign $s\in\{-1,1\}$ such that $q(x_j)\to\lambda=sa$. Since $\lambda$ is real,
$$\|Kx_j-\lambda x_j\|^2=\|Kx_j\|^2-2\lambda q(x_j)+\lambda^2\le2a^2-2\lambda q(x_j)\longrightarrow0.$$
Compactness gives a subsequence $Kx_j\to y$ in norm. Because $\lambda\ne0$ and the displayed residual tends to zero, $x_j\to x=y/\lambda$ in norm. Thus $\|x\|=1$, and continuity of $K$ yields $Kx=\lambda x$. Compactness was applied to the images of a bounded sequence, not to the unit sphere of $H$.

## 3. Eigenspaces and iteration

For $Ke=\lambda e$ with $e\ne0$, self-adjointness makes $\lambda\|e\|^2=\langle Ke,e\rangle$ real, hence $\lambda\in\mathbb R$. If $Ke=\lambda e$ and $Kf=\mu f$, then $\lambda\langle e,f\rangle=\langle Ke,f\rangle=\langle e,Kf\rangle=\mu\langle e,f\rangle$ because the eigenvalues are real. Distinct eigenvalues therefore give orthogonal eigenspaces. If a nonzero eigenspace were infinite-dimensional, choose an orthonormal sequence in it. Its images under $K$ have pairwise distance $\sqrt2|\lambda|$, contradicting compactness; the multiplicity is finite.

Choose $e_1$ by the extremal argument. Its orthogonal complement is invariant: for $v\perp e_1$, $\langle Kv,e_1\rangle=\langle v,Ke_1\rangle=0$. The restriction is again compact and self-adjoint on a closed Hilbert subspace. If it is nonzero, choose an extremal $e_2$ there and continue. At the $j$ th step, $|\lambda_j|$ is the norm of the restriction before removing $e_j$, so these magnitudes are nonincreasing. Either a remaining restriction is zero and the process stops, or it gives an orthonormal sequence. In the infinite case, if $|\lambda_j|$ stayed at least $\varepsilon>0$ along a subsequence, the images $Ke_j=\lambda_je_j$ would have pairwise distance at least $\sqrt2\varepsilon$. Compactness forbids this, so $\lambda_j\to0$.

## 4. Completeness and norm convergence

Let $P_Nx=\sum_{j\le N}\langle x,e_j\rangle e_j$, and $K_N=KP_N$. The remainder $x-P_Nx$ lies in the remaining invariant complement and has norm at most $\|x\|$. If there is a next eigenvector, the restriction norm on that complement is $|\lambda_{N+1}|$, giving
$$\|Kx-K_Nx\|\le|\lambda_{N+1}|\|x\|.$$
Equality of operator norms follows by testing $e_{N+1}$. In the infinite construction this tends to zero. In the finite construction the last complement restriction is zero, so the corresponding finite sum equals $K$ exactly.

Let $E$ be the closed span of the selected vectors. If $x\perp E$, the same restriction estimate for every $N$ gives $Kx=0$ (or the final restriction does so in the finite case). Conversely if $Kx=0$, then $0=\langle Kx,e_j\rangle=\lambda_j\langle x,e_j\rangle$ and every $\lambda_j\ne0$, so $x\perp E$. Hence $E^\perp=\ker K$, or $E=(\ker K)^\perp$. Choose an orthonormal basis of the closed kernel using the earlier separable-Hilbert-space result; adjoining it gives a basis of $H$. This is where a possibly large zero eigenspace must be included. We have proved
$$Kx=\sum_j\lambda_j\langle x,e_j\rangle e_j$$
in norm, even in operator norm for the truncated operators. If $K=0$, the nonzero-eigenvector list is empty and the whole space is its kernel; the zero operator already gives the expansion. Finite-rank cases have zero remainder once all nonzero eigenvectors, with multiplicity, have been included.

## 5. The spectrum and the special role of zero

A listed eigenvalue makes $K-zI$ noninjective, so is spectral. Conversely let $z\ne0$ be outside the eigenvalue list. If the list is infinite, $\lambda_j\to0$ implies $|\lambda_j-z|\ge|z|/2$ for all sufficiently large $j$. The finitely many remaining denominators are nonzero, so all are bounded away from zero. In the finite case this last statement is immediate. Write $x=x_0+\sum_jx_je_j$ with $x_0\in\ker K$. The operator
$$R_zx=-z^{-1}x_0+\sum_j(\lambda_j-z)^{-1}x_je_j$$
is bounded by the reciprocal minimum denominator (including $|z|$ when the kernel is nonzero), using orthogonality. Multiplying the convergent series by bounded $K-zI$ proves both inverse identities. Thus all nonzero spectral values are exactly the nonzero eigenvalues, and the only possible finite accumulation point is zero.

If $H$ is infinite-dimensional and $K$ were boundedly invertible, then $I=K^{-1}K$ would be compact. An infinite orthonormal sequence disproves compactness of the identity, so zero is always spectral. It need not be an eigenvalue: the diagonal operator $e_j\mapsto j^{-1}e_j$ on $\ell^2$ is compact and injective. In nonzero finite dimension, zero is spectral exactly when the kernel is nontrivial; if the kernel is zero the finite expansion has an inverse. On the zero-dimensional Hilbert space every linear map is the unique bijection and the spectrum is empty, a harmless separate case.

## 6. The positive compact operator in the boundary problem

The earlier Green operator has sine eigenvalues $(n\pi)^{-2}$, so $G^{1/2}$ has eigenvalues $(n\pi)^{-1}$ and is compact by finite-rank truncation. Multiplication $M_V$ is bounded with norm at most $\|V\|_\infty$ and self-adjoint for real $V$; it is not asserted compact. The product $S=G^{1/2}M_VG^{1/2}$ is compact, self-adjoint, and satisfies $\langle Sw,w\rangle=\int V|G^{1/2}w|^2\ge0$. Every nonzero eigenvalue $\mu_j$ of $S$ is therefore positive. Apply the proved expansion: on an eigenvector, $(I+S)^{-1}$ multiplies by $(1+\mu_j)^{-1}\le1$, and on $\ker S$ it is the identity. Orthogonality proves a bounded two-sided inverse of norm at most one.

For $f,V$ continuous, set $w=(I+S)^{-1}G^{1/2}f$ and $u=G^{1/2}w$. The spectral theorem alone gives a Hilbert-space equation. The additional bridge is the uniform convergence estimate for the sine series of $G^{1/2}w$, followed by $u=G(f-Vu)$ and the differentiated Green integral. Those facts prove $u$ continuous with zero endpoints and then $C^2$. They were established in the other final problems and remain necessary; an $L^2$ expansion cannot simply be differentiated term by term without justification.

## Marking boundary

This is one complete route, not an exhaustive template. Accept a correct alternative proof with every named obligation met. Quoting the theorem being proved is not evidence for its proof; previously established lemmas may be used when the prompt allows them. Track assistance and the first substantive gap. Author self-review has not been substituted for independent academic review.

## MAT-261

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

### MAT-261-u01 — Topological bridge and the definition of a smooth manifold

Objectives: State the definition of a smooth n-manifold with all three ingredients (topological axioms, charts, smooth overlaps) and explain the role of each.; Verify Hausdorffness, second countability and compactness for subspaces of Euclidean space and for quotients, using open maps and saturated open sets.; Compute transition maps for the stereographic charts on S^n and the affine charts on RP^n and prove smooth compatibility.; Prove that every atlas lies in a unique maximal atlas without Zorn's lemma, and explain when two atlases define the same manifold.

#### MAT-261-u01-ex1: Stereographic charts on the sphere

Prompt: Assume $n\ge1$ throughout this exercise. Let $S^n=\{x=(x^0,x^1,\dots,x^n)\in\mathbb{R}^{n+1}:|x|=1\}$ with the subspace topology, let $N=(1,0,\dots,0)$ and $S=(-1,0,\dots,0)$, and put $U_+=S^n\setminus\{N\}$, $U_-=S^n\setminus\{S\}$. Define
$$\varphi_\pm:U_\pm\to\mathbb{R}^n,\qquad \varphi_\pm(x)=\frac{1}{1\mp x^0}\,(x^1,\dots,x^n).$$

1. Show that $S^n$ is Hausdorff, second countable and compact, naming the general facts you use.
2. Show that $\varphi_+$ is a homeomorphism of $U_+$ onto $\mathbb{R}^n$ by finding its inverse explicitly and checking continuity of both maps.
3. Determine the set $\varphi_+(U_+\cap U_-)\subseteq\mathbb{R}^n$, compute the transition map $\varphi_-\circ\varphi_+^{-1}$ on it in closed form, and prove that the two charts are smoothly compatible. Conclude that $\{(U_\pm,\varphi_\pm)\}$ is a smooth atlas, so $S^n$ is a smooth $n$-manifold.
4. Explain, with a proof, why no single chart can have domain all of $S^n$.

Instructor reference: `content/courses/MAT-261/units/01-topological-bridge-and-the-definition-of-a-manifold/instructor/MAT-261-u01-ex1.reference-solution.md`.

## Reference reasoning (instructor only)

**1. Topology.** $S^n$ carries the subspace topology from $\mathbb{R}^{n+1}$. Subspaces of Hausdorff spaces are Hausdorff and subspaces of second countable spaces are second countable (intersect separating neighbourhoods, respectively a countable basis, with $S^n$), and $\mathbb{R}^{n+1}$ has both properties (rational balls). $S^n=f^{-1}(\{1\})$ for the continuous $f(x)=|x|^2$, so it is closed; it is bounded by $1$; Heine–Borel gives compactness.

**2. The chart $\varphi_+$.** Write $x=(x^0,x')$ with $x'\in\mathbb{R}^n$ and $y=\varphi_+(x)=x'/(1-x^0)$, defined and continuous on $U_+$ since $x^0\neq1$ there. Using $|x'|^2=1-(x^0)^2$,
$$|y|^2=\frac{1-(x^0)^2}{(1-x^0)^2}=\frac{1+x^0}{1-x^0},\qquad\text{so}\qquad x^0=\frac{|y|^2-1}{|y|^2+1},\quad 1-x^0=\frac{2}{|y|^2+1},\quad x'=(1-x^0)\,y=\frac{2y}{|y|^2+1}.$$
Define $\sigma:\mathbb{R}^n\to\mathbb{R}^{n+1}$ by $\sigma(y)=\Big(\frac{|y|^2-1}{|y|^2+1},\frac{2y}{|y|^2+1}\Big)$. A direct check gives $|\sigma(y)|^2=\frac{(|y|^2-1)^2+4|y|^2}{(|y|^2+1)^2}=1$ and $\sigma(y)^0\neq1$, so $\sigma$ maps into $U_+$; the computation above shows $\sigma\circ\varphi_+=\mathrm{id}_{U_+}$, and $\varphi_+\circ\sigma(y)=\frac{2y/(|y|^2+1)}{2/(|y|^2+1)}=y$. So $\varphi_+$ is a bijection onto all of $\mathbb{R}^n$ with inverse $\sigma$; both are continuous (rational expressions with nonvanishing denominators), hence $\varphi_+$ is a homeomorphism $U_+\to\mathbb{R}^n$. The same with $x^0\mapsto-x^0$ handles $\varphi_-$.

**3. Transition map.** $U_+\cap U_-=S^n\setminus\{N,S\}$, and $\varphi_+(S)=0$, so $\varphi_+(U_+\cap U_-)=\mathbb{R}^n\setminus\{0\}$. For $y\neq0$, with $x=\sigma(y)$,
$$1+x^0=\frac{2|y|^2}{|y|^2+1},\qquad \varphi_-\circ\varphi_+^{-1}(y)=\frac{x'}{1+x^0}=\frac{2y/(|y|^2+1)}{2|y|^2/(|y|^2+1)}=\frac{y}{|y|^2}.$$
This is inversion in the unit sphere: smooth on $\mathbb{R}^n\setminus\{0\}$ (quotient of smooth functions with nonvanishing denominator) and equal to its own inverse, so $\varphi_+\circ\varphi_-^{-1}$ is the same map and also smooth. The charts are compatible; they cover $S^n$; hence they form a smooth atlas and $S^n$ is a smooth $n$-manifold. (Sanity check: on the equator $x^0=0$ both charts give $x'$, a unit vector, fixed by inversion.)

**4. No global chart ($n\ge1$).** Suppose $(S^n,\varphi)$ were a chart. Then $\varphi(S^n)$ is a nonempty open subset of $\mathbb{R}^n$, and it is compact (continuous image of a compact space), hence closed in the Hausdorff space $\mathbb{R}^n$. A nonempty subset of the connected space $\mathbb{R}^n$ that is both open and closed is all of $\mathbb{R}^n$, which is not compact: contradiction. (Any correct variant is acceptable: e.g. $\varphi(S^n)$ compact hence bounded, but a nonempty open set is not both compact and open unless the ambient space is compact.)

**Alternative valid approaches.** Poles on the $x^{n}$-axis instead of the $x^0$-axis; stereographic projection from $N$ onto the plane $x^0=-1$ (giving $2x'/(1-x^0)$ and a transition map $4y/|y|^2$); graph charts $x^i=\pm\sqrt{1-\sum_{j\neq i}(x^j)^2}$ on the $2(n+1)$ hemispheres, whose overlaps are also smooth. Accept these if the domains and formulas are correct; note that the task set the stereographic charts.

**Common gaps.** Not identifying the overlap image (writing $\mathbb{R}^n$ instead of $\mathbb{R}^n\setminus\{0\}$); asserting continuity of the inverse without a formula; in part 4 arguing only that "$S^n$ is compact and $\mathbb{R}^n$ is not" (one must use that $\varphi(S^n)$ is open and $\mathbb{R}^n$ connected, or an equivalent fact); treating $\mathbb{R}^n$ as compact.


For completeness, the separate zero-dimensional sphere $S^0$ has two points, while $\mathbb R^0$ and its nonempty open subset have one point; a single chart is impossible by cardinality. The noncompactness argument above applies only for $n\ge1$.

#### MAT-261-u01-ex2: Real projective space is a smooth manifold

Prompt: Let $\mathbb{RP}^n=(\mathbb{R}^{n+1}\setminus\{0\})/\mathbb{R}^*$ with the quotient topology, $\pi$ the projection, $[x^0:\dots:x^n]=\pi(x)$, and for $i=0,\dots,n$ let $U_i=\{[x]:x^i\neq0\}$ and
$$\varphi_i([x^0:\dots:x^n])=\Big(\frac{x^0}{x^i},\dots,\frac{x^{i-1}}{x^i},\frac{x^{i+1}}{x^i},\dots,\frac{x^n}{x^i}\Big)\in\mathbb{R}^n .$$

1. Show that $\pi$ is an open map and deduce that $\mathbb{RP}^n$ is second countable.
2. Prove that $\mathbb{RP}^n$ is Hausdorff. (A quotient of a Hausdorff space need not be Hausdorff, so an argument specific to this quotient is required.)
3. Show that $\mathbb{RP}^n$ is compact.
4. Show that $\varphi_i$ is well defined and is a homeomorphism from $U_i$ onto $\mathbb{R}^n$. For $i\neq j$ determine $\varphi_i(U_i\cap U_j)$, write down $\varphi_j\circ\varphi_i^{-1}$ explicitly, and conclude that the charts are smoothly compatible, so $\mathbb{RP}^n$ is a smooth $n$-manifold.

Instructor reference: `content/courses/MAT-261/units/01-topological-bridge-and-the-definition-of-a-manifold/instructor/MAT-261-u01-ex2.reference-solution.md`.

## Reference reasoning (instructor only)

Write $E=\mathbb{R}^{n+1}\setminus\{0\}$ and $\pi:E\to\mathbb{RP}^n$.

**1. $\pi$ is open; second countability.** For $W\subseteq E$ open, $\pi^{-1}(\pi(W))=\bigcup_{\lambda\in\mathbb{R}^*}\lambda W$, a union of images of $W$ under the homeomorphisms $x\mapsto\lambda x$ of $E$, hence open. By definition of the quotient topology $\pi(W)$ is open. So $\pi$ is an open continuous surjection. If $\mathcal{B}$ is a countable basis of $E$ (rational balls contained in $E$), then $\{\pi(B):B\in\mathcal{B}\}$ is a countable family of open sets, and it is a basis: for $W'\subseteq\mathbb{RP}^n$ open and $\pi(x)\in W'$, pick $B\in\mathcal{B}$ with $x\in B\subseteq\pi^{-1}(W')$; then $\pi(x)\in\pi(B)\subseteq W'$.

**2. Hausdorff.** Let $[u]\neq[v]$; rescale so $u,v\in S^n$. The four points $\pm u,\pm v$ are distinct (if $v=\pm u$ then $[u]=[v]$). Choose $\varepsilon>0$ less than half the minimum distance between any two of them and let $A=B(u,\varepsilon)\cup B(-u,\varepsilon)$, $B=B(v,\varepsilon)\cup B(-v,\varepsilon)$, open subsets of $S^n$ that are symmetric ($A=-A$, $B=-B$) and disjoint. Define the cones $\tilde A=\{\lambda a:\lambda\in\mathbb{R}^*,a\in A\}$ and $\tilde B$ likewise. Each is open in $E$, being the preimage of an open subset of $S^n$ under the continuous retraction $r:E\to S^n$, $r(x)=x/|x|$ (note $r^{-1}(A)=\tilde A$ because $A$ is symmetric). Each is saturated by construction. They are disjoint: if $\lambda a=\mu b$ with $a\in A$, $b\in B$ unit vectors then $a=\pm b$, so $a\in A\cap B=\varnothing$ (using symmetry of $B$). Hence $\pi(\tilde A)$ and $\pi(\tilde B)$ are open (part 1), disjoint (saturated disjoint sets have disjoint images), and contain $[u]$ and $[v]$ respectively.

**3. Compact.** $\pi|_{S^n}:S^n\to\mathbb{RP}^n$ is continuous and surjective (every line meets $S^n$), and $S^n$ is compact, so $\mathbb{RP}^n$ is compact.

**4. Charts.** If $[x]=[x']$ then $x'=\lambda x$ and $x'^k/x'^i=x^k/x^i$, so $\varphi_i$ is well defined on $U_i$, which is open since $\pi^{-1}(U_i)=\{x^i\neq0\}$ is open. $\varphi_i\circ\pi$ is continuous on $\pi^{-1}(U_i)$ (rational functions with nonvanishing denominator), so $\varphi_i$ is continuous by the universal property of the quotient topology (applied to the open saturated set $\pi^{-1}(U_i)$). Define $s_i:\mathbb{R}^n\to E$ by $s_i(y^0,\dots,y^{i-1},y^{i+1},\dots,y^n)=(y^0,\dots,y^{i-1},1,y^{i+1},\dots,y^n)$ (indices chosen to skip $i$). Then $\varphi_i\circ\pi\circ s_i=\mathrm{id}$ and $\pi\circ s_i\circ\varphi_i=\mathrm{id}_{U_i}$ (divide a representative by $x^i$), so $\varphi_i$ is a bijection onto $\mathbb{R}^n$ with continuous inverse $\pi\circ s_i$: a homeomorphism.

For $i\neq j$, $\varphi_i(U_i\cap U_j)=\{y:y^j\neq0\}$ (the $j$-th homogeneous coordinate of $s_i(y)$ is $y^j$), an open set. On it,
$$\varphi_j\circ\varphi_i^{-1}(y)=\varphi_j([y^0:\dots:1:\dots:y^n])=\Big(\frac{y^0}{y^j},\dots,\frac{1}{y^j},\dots,\widehat{\frac{y^j}{y^j}},\dots,\frac{y^n}{y^j}\Big),$$
where $1/y^j$ sits in the $i$-th position and the $j$-th entry is omitted. Each component is a rational function with denominator $y^j\neq0$, hence smooth; the inverse transition map has the same form with $i$ and $j$ exchanged. So the charts are compatible, they cover $\mathbb{RP}^n$, and together with parts 1–2 this makes $\mathbb{RP}^n$ a smooth $n$-manifold.

**Alternative valid approaches.** Hausdorffness via the continuous function $F([x],[y])=\dfrac{\sum_{k<l}(x^ky^l-x^ly^k)^2}{|x|^2|y|^2}$ on $\mathbb{RP}^n\times\mathbb{RP}^n$, which vanishes exactly on the diagonal (so the diagonal is closed, which is equivalent to Hausdorff); or via $\mathbb{RP}^n\cong S^n/\{\pm1\}$ as a quotient of a compact Hausdorff space by a finite group acting freely; or via the embedding $[x]\mapsto xx^{T}/|x|^2$ into symmetric matrices (compare Gudmundsson, Example 3.26, used again in MAT-262). Accept any of these with the details supplied.

**Common gaps.** Claiming that quotients of Hausdorff spaces are Hausdorff; forgetting symmetry of $A$ and $B$ when proving the cones are disjoint; proving continuity of $\varphi_i$ by "it is given by a formula" without passing through $\pi$; omitting the overlap domain $\{y^j\neq0\}$; saying "closed and bounded" of a space that is not a subset of Euclidean space.

#### MAT-261-u01-ex3: Maximal atlases without Zorn's lemma

Prompt: Let $X$ be a Hausdorff, second countable space and $\mathcal{A}$ an atlas on $X$. Define
$$\mathcal{A}_{\max}=\{(V,\psi)\text{ a chart on }X:\ (V,\psi)\text{ is compatible with every chart of }\mathcal{A}\}.$$

1. Prove that any two charts in $\mathcal{A}_{\max}$ are compatible with each other, so $\mathcal{A}_{\max}$ is an atlas. (Smoothness of a map between open subsets of $\mathbb{R}^n$ is a local property; use the charts of $\mathcal{A}$ to test it.)
2. Prove that $\mathcal{A}\subseteq\mathcal{A}_{\max}$ and that $\mathcal{A}_{\max}$ is maximal.
3. Prove that $\mathcal{A}_{\max}$ is the only maximal atlas containing $\mathcal{A}$.
4. Deduce that two atlases are equivalent (their union is an atlas) if and only if they determine the same maximal atlas.

The notes' Exercise 1 suggests Zorn's lemma for the existence of a maximal atlas. Say in one sentence why no choice principle is needed.

Instructor reference: `content/courses/MAT-261/units/01-topological-bridge-and-the-definition-of-a-manifold/instructor/MAT-261-u01-ex3.reference-solution.md`.

## Reference reasoning (instructor only)

Throughout, "compatible" means: both transition maps are smooth on their (open) domains. Smoothness of a map between open subsets of $\mathbb{R}^n$ is local: it holds on an open set if it holds on a neighbourhood of each point.

**1. $\mathcal{A}_{\max}$ is an atlas.** Let $(V,\psi),(W,\chi)\in\mathcal{A}_{\max}$ and $x\in V\cap W$. Since $\mathcal{A}$ covers $X$ there is $(U,\varphi)\in\mathcal{A}$ with $x\in U$. The set $O=\psi(U\cap V\cap W)$ is open in $\mathbb{R}^n$ (as $\psi$ is a homeomorphism onto an open set and $U\cap V\cap W$ is open), contains $\psi(x)$, and on $O$
$$\chi\circ\psi^{-1}=(\chi\circ\varphi^{-1})\circ(\varphi\circ\psi^{-1}),$$
where $\varphi\circ\psi^{-1}$ is smooth on $\psi(U\cap V)\supseteq O$ (compatibility of $(V,\psi)$ with $(U,\varphi)$) and maps $O$ into $\varphi(U\cap V\cap W)\subseteq\varphi(U\cap W)$, on which $\chi\circ\varphi^{-1}$ is smooth (compatibility of $(W,\chi)$ with $(U,\varphi)$). Compositions of smooth maps are smooth, so $\chi\circ\psi^{-1}$ is smooth near $\psi(x)$. As $x\in V\cap W$ was arbitrary, $\chi\circ\psi^{-1}$ is smooth on $\psi(V\cap W)$. Exchanging the roles of $\psi$ and $\chi$ gives smoothness of $\psi\circ\chi^{-1}$. Hence any two charts of $\mathcal{A}_{\max}$ are compatible. Its charts cover $X$ because (part 2) $\mathcal{A}\subseteq\mathcal{A}_{\max}$, so $\mathcal{A}_{\max}$ is an atlas.

**2. Containment and maximality.** Each chart of $\mathcal{A}$ is compatible with every chart of $\mathcal{A}$ (pairwise compatibility, and a chart is compatible with itself since the transition map is the identity), so $\mathcal{A}\subseteq\mathcal{A}_{\max}$. If a chart $(V,\psi)$ is compatible with every chart of $\mathcal{A}_{\max}$, it is in particular compatible with every chart of $\mathcal{A}\subseteq\mathcal{A}_{\max}$, so $(V,\psi)\in\mathcal{A}_{\max}$. Thus $\mathcal{A}_{\max}$ contains every chart compatible with all its charts: it is maximal.

**3. Uniqueness.** Let $\mathcal{M}$ be a maximal atlas with $\mathcal{A}\subseteq\mathcal{M}$. Every chart of $\mathcal{M}$ is compatible with every chart of $\mathcal{M}$, in particular with every chart of $\mathcal{A}$, so $\mathcal{M}\subseteq\mathcal{A}_{\max}$. Conversely, let $(V,\psi)\in\mathcal{A}_{\max}$ and $(W,\chi)\in\mathcal{M}$. Both are compatible with every chart of $\mathcal{A}$, so by the argument of part 1 (which used only compatibility with the covering family $\mathcal{A}$) they are compatible with each other. Hence $(V,\psi)$ is compatible with every chart of $\mathcal{M}$, and maximality of $\mathcal{M}$ gives $(V,\psi)\in\mathcal{M}$. So $\mathcal{A}_{\max}\subseteq\mathcal{M}$ and $\mathcal{M}=\mathcal{A}_{\max}$.

**4. Equivalence.** If $\mathcal{A}\cup\mathcal{B}$ is an atlas, every chart of $\mathcal{B}$ is compatible with every chart of $\mathcal{A}$, so $\mathcal{B}\subseteq\mathcal{A}_{\max}$; then $\mathcal{A}_{\max}$ is a maximal atlas containing $\mathcal{B}$, hence equals $\mathcal{B}_{\max}$ by part 3. Conversely if $\mathcal{A}_{\max}=\mathcal{B}_{\max}$ then $\mathcal{A}\cup\mathcal{B}\subseteq\mathcal{A}_{\max}$ consists of pairwise compatible charts covering $X$, so it is an atlas.

**On Zorn's lemma.** The maximal atlas is *defined* by an explicit property (compatibility with the given charts) rather than obtained as a maximal element of a poset, so no choice principle is used; Zorn would also give existence but not the uniqueness or the description.

**Common gaps.** Omitting the open set on which the composition is formed (the argument needs $\psi(U\cap V\cap W)$, not $\psi(V\cap W)$); forgetting that the argument of part 1 must be applied again in part 3; in part 4 proving only one direction.

### MAT-261-u02 — Smooth maps, the standard pathologies and the derivative

Objectives: Define smooth maps and diffeomorphisms between manifolds and prove that smoothness can be tested with one atlas on each side.; Construct the line with two origins, show it has a smooth atlas and is second countable but not Hausdorff, and derive the failure of unique limits.; Show that the charts x and x^3 on R give different smooth structures that are nonetheless diffeomorphic, and explain the distinction between structures and diffeomorphism classes.; State the definition of the differential, prove its uniqueness, and define rank, immersion and submersion with chart-independence justified.

#### MAT-261-u02-ex1: The line with two origins

Prompt: Let $E=\mathbb{R}\times\{0,1\}$ (two disjoint copies of $\mathbb{R}$), let $\sim$ be the equivalence relation generated by $(t,0)\sim(t,1)$ for $t\neq0$, let $X=E/{\sim}$ with the quotient topology and $\pi:E\to X$ the projection. Write $0_i=\pi(0,i)$ for the two origins and $U_i=\pi(\mathbb{R}\times\{i\})$.

1. Show that $\pi$ is an open map and that $X$ is second countable. Define $\varphi_i:U_i\to\mathbb{R}$ by $\varphi_i(\pi(t,i))=t$; show $\varphi_i$ is well defined and a homeomorphism, compute the transition map $\varphi_1\circ\varphi_0^{-1}$ with its domain, and conclude that $\{(U_0,\varphi_0),(U_1,\varphi_1)\}$ is a smooth atlas.
2. Prove that $X$ is not Hausdorff.
3. Show that the sequence $x_n=\pi(1/n,0)$ converges to $0_0$ and to $0_1$. Deduce that limits of sequences in $X$ are not unique and exhibit a compact subset of $X$ that is not closed.
4. State precisely which clause of the definition of a smooth manifold fails for $X$, and which clauses hold.

Instructor reference: `content/courses/MAT-261/units/02-smooth-maps-pathologies-and-the-derivative/instructor/MAT-261-u02-ex1.reference-solution.md`.

## Reference reasoning (instructor only)

Let $\tau:E\to E$ swap the two copies, $\tau(t,i)=(t,1-i)$, a homeomorphism.

**1. Atlas.** *Openness of $\pi$.* For $W\subseteq E$ open, $\pi^{-1}(\pi(W))=W\cup\tau\big(W\setminus\{(0,0),(0,1)\}\big)$: a point is identified with its swapped copy exactly when $t\neq0$. Both pieces are open ($W\setminus\{\text{two points}\}$ is open, $\tau$ is a homeomorphism), so $\pi(W)$ is open by definition of the quotient topology. *Second countability.* $E$ has a countable basis (rational intervals on each copy) and $\pi$ is open and surjective, so the images of basic sets form a countable basis of $X$ (unit 1, bridge fact 3). *Charts.* $U_i=\pi(\mathbb{R}\times\{i\})$ is open. $\pi$ is injective on $\mathbb{R}\times\{i\}$ (identifications only cross between copies), so $\varphi_i$ is well defined and bijective onto $\mathbb{R}$. It is continuous: $\pi^{-1}(U_i)=(\mathbb{R}\times\{i\})\cup((\mathbb{R}\setminus\{0\})\times\{1-i\})$ and on it $\varphi_i\circ\pi(t,j)=t$, the first coordinate, continuous; by the universal property of the quotient (applied on the open saturated set $\pi^{-1}(U_i)$) $\varphi_i$ is continuous. Its inverse $t\mapsto\pi(t,i)$ is continuous as a composition of the inclusion and $\pi$. So each $(U_i,\varphi_i)$ is a chart. *Overlap.* $U_0\cap U_1=\pi((\mathbb{R}\setminus\{0\})\times\{0\})$, so $\varphi_0(U_0\cap U_1)=\mathbb{R}\setminus\{0\}$, and for $t\neq0$, $\varphi_1\circ\varphi_0^{-1}(t)=\varphi_1(\pi(t,0))=\varphi_1(\pi(t,1))=t$. The transition map is the identity of $\mathbb{R}\setminus\{0\}$, smooth with smooth inverse. The two charts cover $X$: a smooth atlas.

**2. Not Hausdorff.** Let $A\ni0_0$ and $B\ni0_1$ be open. Since $\varphi_0$ is a homeomorphism $U_0\to\mathbb{R}$, $\varphi_0(A\cap U_0)$ is an open set containing $0$, so there is $\varepsilon>0$ with $\pi((-\varepsilon,\varepsilon)\times\{0\})\subseteq A$; likewise $\pi((-\delta,\delta)\times\{1\})\subseteq B$ for some $\delta>0$. For $0<|t|<\min(\varepsilon,\delta)$ the point $\pi(t,0)=\pi(t,1)$ lies in $A\cap B$. So no two neighbourhoods of the origins are disjoint.

**3. Limits and compactness.** $\varphi_0(x_n)=1/n\to0=\varphi_0(0_0)$ and, since $x_n=\pi(1/n,1)$, $\varphi_1(x_n)=1/n\to0=\varphi_1(0_1)$; charts are homeomorphisms, so $x_n\to0_0$ and $x_n\to0_1$. Limits are not unique. Let $K=\{x_n:n\ge1\}\cup\{0_0\}$. Then $K=\varphi_0^{-1}(\{1/n\}\cup\{0\})$ is the homeomorphic image of a compact subset of $\mathbb{R}$, hence compact. It is not closed: every neighbourhood of $0_1$ contains $x_n$ for all large $n$ (part 2 or the convergence), so $0_1\in\overline{K}$, but $0_1\notin K$ because $\varphi_0$ is injective on $U_0$ and $0_1\notin U_0$ (indeed $0_1\in U_0$ would mean $0_1=\pi(t,0)$ for some $t$, impossible as $(0,1)\not\sim(t,0)$ for any $t$). In a Hausdorff space compact sets are closed, which is a second proof of part 2.

**4. Diagnosis.** The atlas clause and second countability hold; the Hausdorff clause fails. $X$ is a "non-Hausdorff manifold", which Definition 1.3 excludes.

**Alternative valid approaches.** Non-Hausdorffness via part 3 (a sequence with two limits cannot exist in a Hausdorff space); the quotient-topology verification can be replaced by describing a basis of $X$ directly. A learner may define $X$ as $\mathbb{R}\sqcup\{0'\}$ with a basis; accept if the topology is specified unambiguously.

**Common gaps.** Proving non-Hausdorffness only for the basic neighbourhoods $\pi((-\varepsilon,\varepsilon)\times\{i\})$ without reducing an arbitrary neighbourhood to one (the homeomorphism $\varphi_i$ is what allows the reduction); omitting the overlap domain; asserting that $K$ is not closed without naming the limit point outside $K$; claiming "limits unique" from the atlas.

#### MAT-261-u02-ex2: Two smooth structures on the line

Prompt: Let $\mathbb{R}_1$ denote $\mathbb{R}$ with the smooth structure generated by the chart $(\mathbb{R},\mathrm{id})$, and $\mathbb{R}_2$ denote $\mathbb{R}$ with the smooth structure generated by the single chart $(\mathbb{R},\varphi)$, $\varphi(x)=x^3$.

1. Show that $(\mathbb{R},\varphi)$ is a chart (a homeomorphism onto $\mathbb{R}$), so that $\mathbb{R}_2$ is a smooth manifold, and show that the two smooth structures are different (the charts $\mathrm{id}$ and $\varphi$ are not compatible).
2. Show that the identity map $\mathbb{R}_1\to\mathbb{R}_2$ is smooth but is not a diffeomorphism.
3. Find a diffeomorphism $F:\mathbb{R}_1\to\mathbb{R}_2$ and prove that it is one, writing out both chart expressions.
4. Generalise: for any homeomorphism $h:\mathbb{R}\to\mathbb{R}$, show that $\mathbb{R}$ with the smooth structure generated by $(\mathbb{R},h)$ is diffeomorphic to $\mathbb{R}_1$. Then explain in at most three sentences the difference between "two different smooth structures" and "two non-diffeomorphic manifolds", and state (without proof) what Milnor showed about $S^7$.

Instructor reference: `content/courses/MAT-261/units/02-smooth-maps-pathologies-and-the-derivative/instructor/MAT-261-u02-ex2.reference-solution.md`.

## Reference reasoning (instructor only)

Recall the test: $f:\mathbb{R}_1\to\mathbb{R}_2$ is smooth iff $\varphi\circ f\circ\mathrm{id}^{-1}=\varphi\circ f$ is smooth $\mathbb{R}\to\mathbb{R}$; $g:\mathbb{R}_2\to\mathbb{R}_1$ is smooth iff $\mathrm{id}\circ g\circ\varphi^{-1}=g\circ\varphi^{-1}$ is smooth. (Both manifolds have a one-chart atlas, and one atlas suffices.)

**1. Two structures.** $\varphi(x)=x^3$ is continuous and strictly increasing with continuous inverse $\varphi^{-1}(y)=y^{1/3}$ (the real cube root), so $\varphi$ is a homeomorphism $\mathbb{R}\to\mathbb{R}$ and $(\mathbb{R},\varphi)$ is a chart; $\mathbb{R}$ is Hausdorff and second countable, so $\mathbb{R}_2$ is a smooth manifold. The charts $\mathrm{id}$ and $\varphi$ are compatible only if both $\varphi\circ\mathrm{id}^{-1}=\varphi$ and $\mathrm{id}\circ\varphi^{-1}=\varphi^{-1}$ are smooth; but $\varphi^{-1}(y)=y^{1/3}$ has difference quotient $y^{1/3}/y=y^{-2/3}\to\infty$ as $y\to0$, so it is not differentiable at $0$. Hence $(\mathbb{R},\mathrm{id})\notin$ the maximal atlas of $\mathbb{R}_2$ and the two smooth structures are different.

**2. The identity.** As a map $\mathbb{R}_1\to\mathbb{R}_2$ its chart expression is $\varphi\circ\mathrm{id}=x^3$, smooth; so the identity is smooth. Its inverse, the identity $\mathbb{R}_2\to\mathbb{R}_1$, has chart expression $\mathrm{id}\circ\varphi^{-1}=y^{1/3}$, not smooth at $0$. So the identity is a smooth homeomorphism that is not a diffeomorphism.

**3. A diffeomorphism.** Let $F(x)=x^{1/3}$, a homeomorphism of $\mathbb{R}$ with inverse $F^{-1}(y)=y^3$. Chart expression of $F:\mathbb{R}_1\to\mathbb{R}_2$: $\varphi\circ F(x)=(x^{1/3})^3=x$, smooth. Chart expression of $F^{-1}:\mathbb{R}_2\to\mathbb{R}_1$: $F^{-1}\circ\varphi^{-1}(t)=(t^{1/3})^3=t$, smooth. Hence $F$ is a diffeomorphism and $\mathbb{R}_1\cong\mathbb{R}_2$. (The notes' phrase "diffeomorphic by the map $x\mapsto x^3$ thought of as a map $\mathbb{R}_1\to\mathbb{R}_2$" must be read with care: the map that is the identity *in the charts* is $F=\varphi^{-1}$; its chart expression, not the map, is $x\mapsto x$. Accept either description if the learner's chart computations are correct.)

**4. General statement.** For a homeomorphism $h:\mathbb{R}\to\mathbb{R}$, $(\mathbb{R},h)$ is a chart and generates a smooth structure $\mathbb{R}_h$. The map $G=h^{-1}:\mathbb{R}_1\to\mathbb{R}_h$ has chart expression $h\circ G\circ\mathrm{id}^{-1}=h\circ h^{-1}=\mathrm{id}$ and its inverse $h:\mathbb{R}_h\to\mathbb{R}_1$ has expression $\mathrm{id}\circ h\circ h^{-1}=\mathrm{id}$; both smooth, so $G$ is a diffeomorphism. Thus every one-chart structure on $\mathbb{R}$ is diffeomorphic to the standard one (in fact every smooth structure on $\mathbb{R}$ is, but that needs more than this exercise).

*Structures versus diffeomorphism classes.* A smooth structure is a maximal atlas on a fixed topological space; two structures are "different" when neither's charts belong to the other. Two manifolds are diffeomorphic when some diffeomorphism exists between them, which need not be the identity of the underlying set. So different structures on the same space can give diffeomorphic manifolds, as here. An *exotic* structure is one not diffeomorphic to the standard one by any map at all. Milnor (1956) showed that $S^7$ carries smooth structures not diffeomorphic to the standard structure; the notes mention that such a structure can be given by an atlas with two charts.

**Common gaps.** Checking only $\varphi\circ f$ and forgetting the inverse direction; writing $F(x)=x^3$ (whose chart expression is $x^9$, smooth, but whose inverse has expression $t^{1/9}$, not smooth); concluding "not diffeomorphic" from the failure of the identity; describing Milnor's result as "different atlases on $S^7$" (every manifold has many atlases; the point is non-diffeomorphism).

#### MAT-261-u02-ex3: Why the two axioms are in the definition

Prompt: In your own words, without the notes open, and in under 250 words: explain why the definition of a smooth manifold includes the Hausdorff axiom and the second countability axiom in addition to the existence of a smooth atlas. For each axiom give (a) one example showing that 'locally Euclidean with smooth overlaps' does not imply it, and (b) one consequence of the axiom that the theory will rely on (you may name results to come: uniqueness of limits, closedness of compact sets, partitions of unity, embedding in some $\mathbb{R}^N$, countable atlases).

Instructor reference: `content/courses/MAT-261/units/02-smooth-maps-pathologies-and-the-derivative/instructor/MAT-261-u02-ex3.reference-solution.md`.

# Reference reasoning

An atlas controls each coordinate neighbourhood and its overlaps, but global points can still fail to separate. The line with two origins has Euclidean charts and smooth identity transitions, yet every neighbourhood of one origin meets every neighbourhood of the other; the sequence of positive points $1/n$ converges to both. Hausdorffness rules out this ambiguity and ensures compact subsets are closed. The long line gives the independent countability warning: it is Hausdorff and locally Euclidean but not second countable. A countable basis supplies a countable atlas; together with local compactness and Hausdorffness it gives the paracompactness used to construct locally finite partitions of unity. Local Euclidean structure alone therefore supplies neither global axiom. An uncountable disjoint union of real lines is another acceptable second-countability counterexample. Metri-zability is not equivalent to Hausdorffness for arbitrary spaces; conclusions should be stated in the locally Euclidean setting with all needed hypotheses.

This is one acceptable response, not a phrase-matching answer. Accept complete alternate reasoning.

#### MAT-261-u02-ex4: A smooth circle map and coordinate-independent rank

Prompt: Let $F:S^1\to S^1$ be $F(x,y)=(x^2-y^2,2xy)$. (a) Show it maps the circle to itself and compute its local expressions in angle charts. (b) Compute its differential on the tangent vector $(-y,x)$ and determine its rank everywhere. Prove why changes of source and target chart cannot change that rank. (c) Determine every fibre and decide whether it is a diffeomorphism. (d) Compare the reasons this map fails to be a diffeomorphism with the map that is the identity from the standard real line to the line charted by $x^3$, and with the line with two origins.

Instructor reference: `content/courses/MAT-261/units/02-smooth-maps-pathologies-and-the-derivative/instructor/MAT-261-u02-ex4.reference-solution.md`.

# A smooth circle map and coordinate-independent rank — reference reasoning

(a) The squared norm of the output is $(x^2+y^2)^2=1$. In local angle coordinates $t$ with $(x,y)=(\cos t,\sin t)$, the output has angle $2t$ modulo $2\pi$; on sufficiently small source and target arcs this is $2t$ plus a constant multiple of $2\pi$, a smooth expression. (b) The ambient derivative applied to $(-y,x)$ is $(-4xy,2(x^2-y^2))$, twice the positive unit tangent at $F(x,y)$, hence nonzero and rank 1. Chart changes multiply the one-dimensional derivative on each side by invertible derivatives, preserving rank; in general the same matrix multiplication argument applies in any dimensions. (c) Each target point has exactly two antipodal preimages, so the map is not bijective and not a diffeomorphism despite full rank everywhere. (d) For the identity map from the standard line to the cubic-chart line, the chart expression is $t\mapsto t^3$, whose derivative vanishes at 0; its inverse chart expression is not smooth there, although the underlying map is bijective. These are both valid Hausdorff second-countable manifolds. The line with two origins fails the Hausdorff axiom itself, despite local smooth charts, so it is not a manifold under this course definition. These are three distinct failures: global injectivity, local inverse smoothness, and the ambient definition.

Accept complete alternative arguments; this is an authored reference, not an exhaustive oracle.

### MAT-261-u03 — Inverse and implicit function theorems; submanifolds

Objectives: Prove the local inverse theorem by contraction, and derive the implicit theorem with the split-kernel hypothesis in Banach spaces.; Use a regular-value computation to identify a submanifold and its tangent spaces, including the orthogonal group.; Explain why local invertibility and local ODE existence do not assert global invertibility or existence.

#### MAT-261-u03-ex1: A regular matrix level set

Prompt: For $q(A)=A^TA$ with target the symmetric $n\times n$ matrices, prove that $I$ is regular. Determine $T_AO(n)$ and the dimension of $O(n)$. Explain why the same regular-value argument fails if the codomain is declared to be all matrices.

Instructor reference: `content/courses/MAT-261/units/03-inverse-and-implicit-function-theorems-and-submanifolds/instructor/MAT-261-u03-ex1.reference-solution.md`.

# A regular matrix level set — reference reasoning

$Dq_A(B)=B^TA+A^TB$. For symmetric $S$ and $A^TA=I$, choose $B=AS/2$, obtaining $S$. Hence the derivative is onto the symmetric target. Its kernel consists of $B=AK$ with $K^T=-K$. The symmetric target dimension is $n(n+1)/2$, so the level dimension is $n(n-1)/2$. Against the full matrix target the derivative image is always symmetric and is not onto for $n\ge2$; for $n=1$ the two targets coincide. The subset remains a manifold despite that failed presentation.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u03-ex2: A derivative that is invertible everywhere

Prompt: Analyse $F(x,y)=(e^x\cos y,e^x\sin y)$. Prove that it is a local diffeomorphism and determine its image and every fibre. Construct a smooth inverse on a suitable open subset of its image, with its domain in the source specified. Does it give a global diffeomorphism?

Instructor reference: `content/courses/MAT-261/units/03-inverse-and-implicit-function-theorems-and-submanifolds/instructor/MAT-261-u03-ex2.reference-solution.md`.

# A derivative that is invertible everywhere — reference reasoning

The derivative columns are $e^x(\cos y,\sin y)$ and $e^x(-\sin y,\cos y)$, with determinant $e^{2x}>0$. Image is the punctured plane. For a point with radius $r>0$ and any argument $\theta$, its fibre is $(\log r,\theta+2\pi k)$, $k\in\mathbb Z$. On the plane with the nonpositive real axis removed, choose the smooth argument in $(-\pi,\pi)$; the inverse is $(\log\sqrt{u^2+v^2},\operatorname{Arg}(u+iv))$ and maps into $\mathbb R\times(-\pi,\pi)$. Periodicity precludes global injectivity. A different branch cut gives another valid local/global-on-a-slit inverse.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u03-ex3: Constraints, a local flow, and the global question

Prompt: Let $M=\{(x,y,z):x^2+y^2=1\}\subset\mathbb R^3$. (a) Produce $M$ by a regular-value argument, compute $T_pM$, and give local coordinates near $(1,0,0)$ using the implicit theorem. (b) Prove that $X=(-y,x,1)$ restricts to a smooth tangent vector field and solve its flow explicitly for all times. (c) Explain why the inclusion $M\to\mathbb R^3$ is an embedding although $M$ is not compact, and contrast this with the insufficient criterion “injective derivative everywhere”.

Instructor reference: `content/courses/MAT-261/units/03-inverse-and-implicit-function-theorems-and-submanifolds/instructor/MAT-261-u03-ex3.reference-solution.md`.

# Constraints, a local flow, and the global question — reference reasoning

For $f=x^2+y^2$, $df_p(v)=2xv_x+2yv_y$, which is onto $\mathbb R$ on $M$. Thus $M$ has dimension 2 and tangent kernel $xv_x+yv_y=0$. Near $(1,0,0)$ one can take coordinates $(y,z)$ with $x=\sqrt{1-y^2}$ and $|y|<1$, restricting neighbourhoods as needed. $x(-y)+y(x)=0$, so $X$ is tangent. The flow is $(x\cos t-y\sin t,x\sin t+y\cos t,z+t)$; it remains on $M$ and exists for every real $t$. The submanifold construction gives the subset topology and charts for which the inclusion is an immersion and a homeomorphism to its image; equivalently this explicit cylinder is an embedded regular level set. Compactness is sufficient for a general injective immersion to be an embedding, not necessary. A noninjective local diffeomorphism from the preceding question already disproves the derivative-only criterion; even injective immersions need a topology/properness check in general.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

### MAT-261-u04 — Vector bundles and the tangent bundle

Objectives: Construct vector bundles from transition functions and verify the cocycle, pullback and Whitney-sum rules.; Identify tangent vectors through coordinates, curves and derivations, and show how the chain rule defines the tangent bundle.; Compute tangent and bundle maps while distinguishing local triviality from global triviality.

#### MAT-261-u04-ex1: The tangent cocycle in a concrete overlap

Prompt: On the positive quadrant use coordinates $(x,y)$ and $(u,v)=(\log x,y/x)$. Compute the component transformation of a tangent vector $a\partial_x+b\partial_y$, its inverse, and $df$ for $f(x,y)=y/x$. Verify that the derivation of $f$ agrees in both coordinate systems.

Instructor reference: `content/courses/MAT-261/units/04-vector-bundles-and-the-tangent-bundle/instructor/MAT-261-u04-ex1.reference-solution.md`.

# The tangent cocycle in a concrete overlap — reference reasoning

The forward Jacobian sends $(a,b)$ to $(a/x,b/x-ya/x^2)=(\alpha,\beta)$. Since $x=e^u$, $y=e^uv$, the inverse sends $(\alpha,\beta)$ to $(x\alpha,y\alpha+x\beta)$. In original coordinates $df(a,b)=b/x-ya/x^2$. In new coordinates $f=v$, so the derivation gives $\beta$, the same number. The inverse matrices multiply to the identity, an explicit cocycle check for this overlap.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u04-ex2: A nontrivial line bundle with a trivial square sum

Prompt: For the Möbius line bundle described in the lesson, prove that it has no nowhere-zero continuous section. Construct a smooth global frame of its Whitney sum with itself. Explain why the pullback under the double covering $S^1\to S^1$, $e^{it}\mapsto e^{2it}$, is trivial.

Instructor reference: `content/courses/MAT-261/units/04-vector-bundles-and-the-tangent-bundle/instructor/MAT-261-u04-ex2.reference-solution.md`.

# A nontrivial line bundle with a trivial square sum — reference reasoning

A section lifts to $a(t+2\pi)=-a(t)$; the intermediate value theorem forces a zero on $[0,2\pi]$, including the possibility of zero at the endpoint. In the doubled bundle the two rotating vectors in the lesson have determinant 1 and both change sign after $2\pi$, so descend to a smooth frame. For the pullback, travelling once around the source traverses the target twice; the fibre identification is $(-1)^2=1$. More explicitly the vector represented by target lift $(2t,1)$ is periodic in $t$ modulo the target equivalence $(s+4\pi,v)\sim(s,v)$ and gives a nowhere-zero smooth section. No argument that simply counts fibre dimensions suffices.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u04-ex3: The sphere tangent bundle is stably trivial

Prompt: Construct explicitly a smooth vector-bundle isomorphism $TS^n\oplus\underline{\mathbb R}\cong\underline{\mathbb R}^{n+1}$ over $S^n$. Prove its inverse is smooth and fibrewise linear. Relate the construction to the tangent space of a regular level set, and explain why it does not prove that $TS^n$ itself is trivial. Give a global frame of $TS^1$ directly.

Instructor reference: `content/courses/MAT-261/units/04-vector-bundles-and-the-tangent-bundle/instructor/MAT-261-u04-ex3.reference-solution.md`.

# The sphere tangent bundle is stably trivial — reference reasoning

The regular-level calculation gives $T_pS^n=p^\perp$. Define $(p,v,t)\mapsto(p,v+tp)$. The inverse is $(p,w)\mapsto(p,w-(w\cdot p)p,w\cdot p)$. Both maps are polynomial in the displayed ambient coordinates, hence smooth, and linear in the fibre arguments; orthogonal decomposition verifies inverse identities. Cancelling a summand is not justified merely by an isomorphism of sums; the conclusion is stable triviality. One should not claim nontriviality of every sphere tangent bundle either. For $S^1\subset\mathbb R^2$, the section $(-y,x)$ is smooth, tangent, nowhere zero, hence is a frame. Nontriviality for $S^2$ needs a separate theorem such as the hairy-ball theorem and is not required here.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

### MAT-261-u05 — Connections on bundles, partitions of unity and embedding in Euclidean space

Objectives: Construct and use a smooth locally finite partition of unity, identifying the role of paracompactness and compactness.; Glue local metrics and connections, and verify their transformation and Leibniz properties.; Prove finite-type bundles are pullbacks of a tautological bundle and prove the compact-manifold embedding construction.

#### MAT-261-u05-ex1: Gluing a connection correctly

Prompt: Let $\nabla^{(i)}$ be connections on $E|_{U_i}$ and $(\rho_i)$ a subordinate smooth locally finite partition. Prove $\nabla=\sum_i\rho_i\nabla^{(i)}$ is a connection. Show that the difference of two connections is $C^\infty(M)$-linear in both the vector field and section. In a line-bundle frame changed by $e'=g e$, derive the change in the connection one-form.

Instructor reference: `content/courses/MAT-261/units/05-partitions-of-unity-universal-bundles-and-embedding/instructor/MAT-261-u05-ex1.reference-solution.md`.

# Gluing a connection correctly — reference reasoning

Local finiteness makes the sum and all its derivatives finite locally; supports allow extension of each weighted term. Additivity and linearity in the vector-field argument are inherited. For a scalar $f$, $\nabla_X(fs)=\sum_i\rho_i[X(f)s+f\nabla_X^{(i)}s]=X(f)s+f\nabla_Xs$. For $D=\nabla-\widetilde\nabla$, the $X(f)s$ terms cancel, so $D_X(fs)=fD_Xs$; $D_{fX}s=fD_Xs$ already follows from each connection. Finally $\nabla(ge)=dg\otimes e+gA\otimes e=(g^{-1}dg+A)\otimes e'$. The form changes, while the connection operator is the same.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u05-ex2: Universal bundle map in coordinates

Prompt: For the finite-cover map $J$ in the lesson, prove that $x\mapsto J_x(E_x)$ is smooth into $\mathrm{Gr}_k(\mathbb R^{mk})$. Give a local formula for the inverse of $E\to f^*\gamma_k$. Explain exactly where a finite cover is used and why a partition need not provide a single global frame of $E$.

Instructor reference: `content/courses/MAT-261/units/05-partitions-of-unity-universal-bundles-and-embedding/instructor/MAT-261-u05-ex2.reference-solution.md`.

# Universal bundle map in coordinates — reference reasoning

Choose a local frame for $E$ near $x_0$. The map $J_x$ becomes a smooth $mk\times k$ matrix $B(x)$ of rank $k$. Pick a coordinate block $B_i(x_0)=\rho_i(x_0)\phi_i$ which is invertible; it stays invertible nearby. Reorder the target blocks so that it is first. The image plane is the graph of $B_{\rm rest}(x)B_i(x)^{-1}$, a smooth Grassmannian chart expression. For $(x,w)$ with $w\in\operatorname{im}B(x)$, the original fibre components are $B_i(x)^{-1}w_i$, so the bundle isomorphism has smooth inverse. Finitely many blocks give finite $mk$. The weighted local coordinate functionals assemble an injective map into a bigger trivial bundle; they need not produce a basis of the original bundle, as the Möbius example shows.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u05-ex3: Prove the compact embedding construction

Prompt: Starting with a compact smooth manifold and a finite chart cover, reconstruct the map $F$ in the lesson and prove it is a smooth embedding. Your account must justify zero extension, injectivity, immersion, and the inverse topology separately. State why the argument neither proves the bound $2n$ nor immediately applies to a noncompact manifold. Illustrate the conclusion by an explicit embedding of $S^1$.

Instructor reference: `content/courses/MAT-261/units/05-partitions-of-unity-universal-bundles-and-embedding/instructor/MAT-261-u05-ex3.reference-solution.md`.

# Prove the compact embedding construction — reference reasoning

Choose subordinate smooth $\rho_i$ with closed support contained in $U_i$. At a point outside $U_i$, a neighbourhood misses the support, so zero extension of $\rho_i x_i$ is smooth there; inside it is a smooth product. Equality of all scalar and vector blocks supplies equal positive $\rho_i$ for some $i$, then equality of chart coordinates, hence injectivity. A kernel vector for $dF$ has $d\rho_i(v)=0$ for all $i$, and the positive block gives $dx_i(v)=0$, hence $v=0$. Compactness and the Hausdorff target make the continuous bijection onto the image a homeomorphism. The target dimension is $m(n+1)$ with no bound on $m$ in terms of $n$ in this argument; a noncompact base may require infinitely many charts and the compact-to-Hausdorff step no longer applies. The ordinary inclusion $S^1\subset\mathbb R^2$ is an explicit embedding: its tangent vector $(-y,x)$ is nonzero and its topology is the subspace topology. This example achieves $2n$ but does not prove that bound generally.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

### MAT-261-u06 — Sard's theorem and stratified spaces

Objectives: State and explain the proof of smooth Sard, including its measure-theoretic and countability hypotheses.; Compute rank strata and distinguish a smooth stratum from its singular closure.; Use dimension and Sard to select a perturbation, and combine this with the compact embedding construction.

#### MAT-261-u06-ex1: Critical points are not critical values

Prompt: For $f(x,y)=x^2y$, compute the critical set and the critical values. Describe every nonzero level as a smooth curve with an explicit parametrization of each component. Describe the zero level and explain where the regular-value theorem applies and where it makes no claim.

Instructor reference: `content/courses/MAT-261/units/06-sards-theorem-and-stratified-spaces/instructor/MAT-261-u06-ex1.reference-solution.md`.

# Critical points are not critical values — reference reasoning

$df=(2xy,x^2)$, so the critical set is $x=0$, whose image is $0$. For $c\ne0$, $x\ne0$ and $y=c/x^2$, giving two components parametrized by $t\mapsto(t,c/t^2)$ for $t>0$ and $t<0$. Their derivatives have first component 1. The zero level is the union of the two axes. Away from the origin it is locally a smooth curve; at the origin the four local branches prevent a one-dimensional manifold structure with the subspace topology. The value 0 is not regular, so the theorem gives no global conclusion for that level; its regular points on the horizontal axis away from 0 still have local level-set coordinates. All nonzero values are regular.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u06-ex2: The shape of a rank stratum

Prompt: Prove the rank-$r$ codimension formula for $n\times k$ matrices using the Schur complement. Specialise to $3\times2$ matrices of rank 1. Find their tangent space at $B_0=\begin{pmatrix}1&0\\0&0\\0&0\end{pmatrix}$ and show that the full-rank locus is open.

Instructor reference: `content/courses/MAT-261/units/06-sards-theorem-and-stratified-spaces/instructor/MAT-261-u06-ex2.reference-solution.md`.

# The shape of a rank stratum — reference reasoning

On the chart where the leading $r$ block $A$ is invertible, multiplication by invertible block-triangular matrices transforms $B$ to $\operatorname{diag}(A,D-QA^{-1}P)$. Thus rank $r$ is precisely the zero Schur complement. Its derivative with respect to $D$ is the identity, proving codimension $(n-r)(k-r)$. For $n=3,k=2,r=1$ this is 2 and dimension 4. At $B_0$, both $P,Q$ vanish, so the linearised constraint is $\dot D=0$, i.e. entries $(2,2)$ and $(3,2)$ of a tangent matrix are zero; the other four entries are arbitrary. Full rank 2 means at least one $2\times2$ minor is nonzero, an open condition.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u06-ex3: Avoiding singular matrices along a disk

Prompt: Let $h:D^2\to M_{4\times2}(\mathbb R)$ be smooth and full rank on the boundary. Prove there is an arbitrarily small constant matrix $A$ such that $h+A$ is full rank on the entire disk, and the boundary homotopy $h+tA$ is full rank for $0\le t\le1$. Name the Sard dimension estimate and compactness step. Explain what changes for $3\times2$ matrices.

Instructor reference: `content/courses/MAT-261/units/06-sards-theorem-and-stratified-spaces/instructor/MAT-261-u06-ex3.reference-solution.md`.

# Avoiding singular matrices along a disk — reference reasoning

The rank 1 stratum in $4\times2$ matrices has codimension $(4-1)(2-1)=3$; rank 0 has codimension 8. Both exceed disk dimension 2. For each stratum use the submersion $(A,x)\mapsto A+h(x)$ on parameter space times disk interior and boundary separately. Its bad incidence manifold has dimension $8+d-c<8$, so Sard says its parameter image is null. Outside a finite union of these null images, $h+A$ avoids both strata. The complement meets every small parameter ball. The compact boundary image has positive distance from the closed rank-deficient locus; take $\|A\|$ below that distance to preserve full rank along $h+tA$. In $3\times2$ matrices the rank 1 codimension is 2, equal to the disk dimension, so the strict-dimension avoidance argument fails: it cannot guarantee no intersection. It does not prove that every such map must intersect, either.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u06-ex4: Mid-course synthesis: local coordinates to a smaller embedding

Prompt: Give a proof portfolio for a compact $n$-manifold, $n\ge1$: (a) construct an embedding into some $\mathbb R^N$ with partitions of unity; (b) when $N>2n+1$, use Sard to find a direction of projection that preserves both injectivity and immersion. Define the bad secant and tangent direction maps, compute their domain dimensions, and identify the final topology argument. Illustrate the method on a circle. You may use smooth projective space and the projectivized tangent bundle as constructed spaces; their bundle charts are studied next unit.

Instructor reference: `content/courses/MAT-261/units/06-sards-theorem-and-stratified-spaces/instructor/MAT-261-u06-ex4.reference-solution.md`.

# Mid-course synthesis: local coordinates to a smaller embedding — reference reasoning

Part(a) is the unit 5 map with vector blocks $\rho_ix_i$ and scalar blocks $\rho_i$; the positive-weight block proves injectivity and its differential, then compact-to-Hausdorff gives embedding. For (b), the secant-line map $M\times M\setminus\Delta\to\mathbb{RP}^{N-1}$ has domain dimension 2n. The tangent-line map $P(TM)\to\mathbb{RP}^{N-1}$ has domain dimension $n+(n-1)=2n-1$. With $N-1>2n$, both images have measure zero by Sard (every point of their domains is critical). Choose a line outside both. Orthogonal projection to its perpendicular hyperplane cannot identify two points because then their difference would lie in that line; it cannot kill a tangent vector because then a tangent direction would be that line. Compactness once more upgrades injective immersion to embedding. Iterate until target dimension $2n+1$. A standard circle in the $xy$-plane of $\mathbb R^3$ projects injectively and immersively onto that plane along the $z$-direction; its planar inclusion already lies in dimension 2. This favourable example does not improve the general dimension count.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

### MAT-261-u07 — Fibre bundles and the medium Whitney embedding theorem

Objectives: Construct fibre-bundle charts for frame and projective bundles, and distinguish fibre bundles from arbitrary surjective submersions.; Prove the compact Whitney embedding bound 2n+1 by avoiding secant and tangent directions.; Explain the immersion bound 2n and why the same projection argument does not prove embedding in 2n.

#### MAT-261-u07-ex1: A bundle chart and a failed bundle

Prompt: Construct a local trivialization of $\mathrm{St}_2(\mathbb R^4)\to\mathrm{Gr}_2(\mathbb R^4)$ using graph charts and identify the fibre and all three dimensions. Then prove that the punctured-plane projection in the lesson is a surjective submersion but is not a fibre bundle.

Instructor reference: `content/courses/MAT-261/units/07-fibre-bundles-and-the-medium-whitney-theorem/instructor/MAT-261-u07-ex1.reference-solution.md`.

# A bundle chart and a failed bundle — reference reasoning

Fix a 2-plane $L_0$ and its orthogonal complement. A nearby plane is graph $A$ with $A:L_0\to L_0^\perp$, giving four base coordinates. A frame is $(I+A)C$ with $C:\mathbb R^2\to L_0$ invertible, giving fibre $GL(2)$ of dimension 4. Projection onto $L_0$ recovers $C$, so this is a smooth product chart and total dimension 8, matching $4\times2$ matrices. For the punctured plane, $d p(v_x,v_y)=v_x$ is onto everywhere and each real $x$ occurs. The zero fibre has two connected components; nearby nonzero fibres have one. A local trivialization around 0 would give diffeomorphic fibres, impossible.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u07-ex2: When is a plane curve projection an immersion?

Prompt: Let $\gamma(t)=(\cos t,\sin t,\sin2t)$ for $t\in\mathbb R/2\pi\mathbb Z$. Show it is an embedding in $\mathbb R^3$. Compare its projections to the $xy$- and $xz$-planes: determine whether each is injective and whether each is an immersion, and locate all failures.

Instructor reference: `content/courses/MAT-261/units/07-fibre-bundles-and-the-medium-whitney-theorem/instructor/MAT-261-u07-ex2.reference-solution.md`.

# When is a plane curve projection an immersion? — reference reasoning

The $xy$ coordinates give the standard circle, hence injectivity modulo $2\pi$; the derivative has first two components $(-\sin t,\cos t)$ and is never zero. Compactness gives embedding. Projection to $xy$ is the ordinary embedded circle. Projection to $xz$ gives $(\cos t,\sin2t)$ with derivative $(-\sin t,2\cos2t)$; it never vanishes, since $\sin t=0$ implies $\cos2t=1$. If cos $t$=cos $s$, then $s=\pm t$ modulo $2\pi$. The minus choice has equal second coordinates only when $\sin2t=0$. The distinct pair is $t=\pi/2,3\pi/2$, both mapping to $(0,0)$; choices 0 and $\pi$ do not create distinct parameters under negation. Thus one double point, with tangent vectors $(-1,-2)$ and $(1,-2)$ whose determinant 4 is nonzero: a transverse crossing. There is no immersion failure.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u07-ex3: Dimension reduction with all hypotheses

Prompt: Prove that every compact smooth $n$-manifold with $n\ge1$ embeds in $\mathbb R^{2n+1}$ and immerses in $\mathbb R^{2n}$. You may use the finite-dimensional embedding constructed in unit 5 and smooth Sard. Construct $P(TM)$ through its bundle charts, identify both bad-direction maps, and explain why the proof stops at different dimensions for the two conclusions.

Instructor reference: `content/courses/MAT-261/units/07-fibre-bundles-and-the-medium-whitney-theorem/instructor/MAT-261-u07-ex3.reference-solution.md`.

# Dimension reduction with all hypotheses — reference reasoning

Charts for $TM$ have transition matrices in $GL(n)$; their induced projective actions glue $P(TM)$ with fibre $\mathbb{RP}^{n-1}$ and dimension $2n-1$. For an embedding into $\mathbb R^N$, the secant map from $(M\times M)\setminus\Delta$ has dimension 2n and the tangent map from $P(TM)$ dimension $2n-1$. When $N-1>2n$, both images are null by Sard, so a line avoiding both gives injective immersion after projection; compactness gives embedding. Iterate down to $N=2n+1$. One additional projection can avoid tangent directions since $2n-1<2n$, giving immersion in $2n$. Secant avoidance at that step is not established because its dimension equals the target direction dimension. Smoothness and second countability permit Sard even on the noncompact secant domain. No conclusion about embedding in $2n$ follows from this argument alone.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

### MAT-261-u08 — Banach-space interlude: Fredholm operators and Smale's Sard theorem

Objectives: Use Banach-space completeness, bounded inverse and compactness with their correct hypotheses.; Compute a Fredholm index, prove its local stability by block elimination, and explain compact parametrices.; Derive the local finite-dimensional reduction of a smooth Fredholm map and state Sard–Smale with the Fredholm and countability hypotheses.

#### MAT-261-u08-ex1: Three operators, three different outcomes

Prompt: On $\ell^2(\mathbb N)$ determine the kernel, range, cokernel dimension and Fredholm index where defined for the right shift $S$, the left shift $S^*$, and $D(x_n)=(x_n/n)$. Prove the range assertions, including nonclosedness for $D$, and show that $D$ is compact.

Instructor reference: `content/courses/MAT-261/units/08-fredholm-operators-and-smales-sard-theorem/instructor/MAT-261-u08-ex1.reference-solution.md`.

# Three operators, three different outcomes — reference reasoning

$S$ is injective, isometric, and has range $\{y:y_1=0\}$, a closed codimension-one subspace, so index $-1$. The left shift is onto, with kernel span $e_1$, hence index 1. For $D$, kernel is 0 and range is precisely $\{y:(ny_n)\in\ell^2\}$. Finite sequences lie in it and are dense. The vector $y_n=1/n$ lies in $\ell^2$ but not in the range, since its unique coordinatewise preimage is the constant-one sequence. Truncations of $y$ prove nonclosedness. The finite-rank truncation $D_N$ satisfies $\|D-D_N\|=1/(N+1)$, giving compactness by operator-norm closure of compact maps. No finite Fredholm index is assigned to $D$; its dense range quotient must not be treated as the zero Banach cokernel.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u08-ex2: Index is stable while nullity jumps

Prompt: For a Banach space $H$ consider $T_t:H\oplus\mathbb R^2\to H\oplus\mathbb R$, $T_t(x,a,b)=(x,ta)$. Compute kernel, cokernel and index for $t=0$ and $t\ne0$. Then explain using the Schur-complement reduction why every sufficiently small bounded perturbation of $T_0$ is Fredholm of the same index, even when it mixes the summands.

Instructor reference: `content/courses/MAT-261/units/08-fredholm-operators-and-smales-sard-theorem/instructor/MAT-261-u08-ex2.reference-solution.md`.

# Index is stable while nullity jumps — reference reasoning

At $t=0$ the kernel is $\{0\}\oplus\mathbb R^2$, range $H\oplus\{0\}$, cokernel $\mathbb R$, index $2-1=1$. At $t\ne0$ the map is onto and the kernel is $\{(0,0,b)\}$, so index $1-0=1$. For a small perturbation write the blocks relative to $H\oplus\mathbb R^2$ and $H\oplus\mathbb R$. The $H\to H$ block $I+a$ remains invertible; eliminate off-diagonal blocks. What remains is $I+a$ together with a finite-dimensional map $Q:\mathbb R^2\to\mathbb R$. Rank-nullity gives $\dim\ker Q-\dim\operatorname{coker}Q=2-1=1$. All ranges in this reduced form are closed; invertible operations preserve that property.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u08-ex3: Compact error does not mean a small error

Prompt: Let $K$ be compact on an infinite-dimensional Banach space $X$. Prove that $I+K$ is Fredholm of index zero without assuming $\|K\|<1$. Explain how the path $I+tK$ is used and give an example where $I+K$ is not invertible although its index is zero.

Instructor reference: `content/courses/MAT-261/units/08-fredholm-operators-and-smales-sard-theorem/instructor/MAT-261-u08-ex3.reference-solution.md`.

# Compact error does not mean a small error — reference reasoning

Taking parametrix $I$ gives both errors $K$ compact, so the proved parametrix criterion makes $I+tK$ Fredholm for every $t\in[0,1]$. The index is locally constant on the Fredholm operators, hence constant on this connected path; at $t=0$ it is 0. For a nonzero bounded rank-one projection $P$ take $K=-P$. Then $I-P$ has kernel $\operatorname{ran}P$ of dimension 1 and range $\ker P$ of codimension 1, hence is not invertible and has index 0. One can construct $P=x_0\otimes\phi$ using a nonzero $x_0$ and a bounded functional with $\phi(x_0)=1$, supplied by Hahn–Banach. No Neumann argument at $t=1$ is available in general.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u08-ex4: A Fredholm cubic family

Prompt: Let $H=\ell^2(\mathbb N;\mathbb R)$, fix $a\in H$, and define $F:H\times\mathbb R\to H\times\mathbb R$ by $F(x,t)=(x,t^3-t+\langle x,a\rangle)$. Prove it is smooth Fredholm of index zero. Determine its critical-value set and the number of points in every regular fibre. Explain the finite-dimensional reduction and why the regular-value set is open dense here, without claiming an infinite-dimensional Lebesgue measure.

Instructor reference: `content/courses/MAT-261/units/08-fredholm-operators-and-smales-sard-theorem/instructor/MAT-261-u08-ex4.reference-solution.md`.

# A Fredholm cubic family — reference reasoning

The derivative is $(v,s)\mapsto(v,(3t^2-1)s+\langle v,a\rangle)$. Subtracting the bounded linear $\langle v,a\rangle$ output reduces it to $I_H\oplus(3t^2-1)$; it is Fredholm of index 0 at every $t$, including zero scalar block where kernel and cokernel both have dimension 1. Critical points have $t=\pm1/\sqrt3$. Their output satisfies $b-\langle x,a\rangle=\mp2/(3\sqrt3)$. Thus the critical values are two closed affine hyperplanes. Writing $c=b-\langle x,a\rangle$, the cubic $t^3-t=c$ has three distinct real roots for $|c|<2/(3\sqrt3)$ and one real root for $|c|>2/(3\sqrt3)$; equality gives a double root and is not regular. This follows from its derivative and values at the two turning points, together with its limits at infinity. Each regular fibre has the stated finite number of points and dimension 0. The two affine hyperplanes have empty interior, so their complement is open dense. All nonlinear analysis occurred in the scalar variable after fixing the $H$ coordinate, which is exactly the normal form. Residual/Baire is the pertinent general conclusion.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

### MAT-261-u09 — Transversality and the strong Whitney embedding theorem

Objectives: Prove the transverse-preimage theorem and the finite-dimensional parametric transversality theorem.; Explain the Fredholm parameter version and the meaning and limits of genericity.; Analyse transverse double points and distinguish the proved projection bound from the additional Whitney-trick input for the strong theorem.

#### MAT-261-u09-ex1: A bifurcation of transverse intersections

Prompt: For $f_a(t)=(t,t^3-t+a)$ and $Z=\mathbb R\times\{0\}$, determine all parameters for which $f_a\pitchfork Z$ and count the intersections for each parameter range. Verify that $F(a,t)=f_a(t)$ is a submersion and reconcile the exceptional parameters with Sard.

Instructor reference: `content/courses/MAT-261/units/09-transversality-and-the-strong-whitney-theorem/instructor/MAT-261-u09-ex1.reference-solution.md`.

# A bifurcation of transverse intersections — reference reasoning

The derivative is $(1,3t^2-1)$, so transversality at a zero of $t^3-t+a$ fails exactly at $t=\pm1/\sqrt3$. The corresponding $a$ are $\pm2/(3\sqrt3)$. For $|a|$ below this threshold there are three simple zeros; above, one; at equality there are two distinct zeros, one double and one simple, so the map is not transverse. The total derivative columns in $(a,t)$ are $(0,1)$ and $(1,3t^2-1)$, determinant $-1$, hence onto. The two exceptional parameters form a null set, in agreement with the parameter theorem. Count distinct intersections separately from multiplicity.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u09-ex2: Transverse self-intersections are finite for a compact immersion

Prompt: Let $i:M^n\to\mathbb R^{2n}$ be an immersion of a compact manifold, and suppose its difference map off the diagonal is transverse to zero. Prove that the set of ordered double pairs is finite. Your proof must rule out accumulation toward the diagonal. If $M$ is oriented and $n$ is even, explain why exchanging the two preimages does not change a double-point sign.

Instructor reference: `content/courses/MAT-261/units/09-transversality-and-the-strong-whitney-theorem/instructor/MAT-261-u09-ex2.reference-solution.md`.

# Transverse self-intersections are finite for a compact immersion — reference reasoning

The difference map domain has dimension 2n and target 2n, so its regular zero set is discrete. For each $p$, the immersion normal form gives a neighbourhood $U_p$ on which $i$ is injective. A finite subcover and a Lebesgue number for a compatible metric yield $\delta>0$ such that pairs with distance $<\delta$ lie together in some $U_p$, hence cannot be distinct double pairs. All double pairs therefore lie in the compact set $\{(x,y):d(x,y)\ge\delta\}$. The zero set there is closed, hence compact, and a compact discrete space is finite. Swapping two oriented $n$-dimensional tangent blocks changes orientation by $(-1)^{n^2}$, which equals 1 for even $n$. For odd $n$ it changes sign, so an unordered pair has no such sign without extra choices.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u09-ex3: Correct the parameter theorem and the Whitney shortcut

Prompt: Write a synthesis in three parts. (a) Prove the regular-parameter/transverse-slice equivalence using the quotient by $T_zZ$. (b) For a Fredholm slice derivative $L$ and finite-dimensional $V=T_zZ$, compute the kernel and cokernel of the parameter projection and derive its index. (c) Explain why a generic immersion in $\mathbb R^{2n}$ with finite transverse double points need not already be an embedding, and state exactly the extra theorem and proof input used to reach the strong Whitney conclusion.

Instructor reference: `content/courses/MAT-261/units/09-transversality-and-the-strong-whitney-theorem/instructor/MAT-261-u09-ex3.reference-solution.md`.

# Correct the parameter theorem and the Whitney shortcut — reference reasoning

(a) With total normal derivative $A:P_0\oplus M_0\to N_0/V$ onto, the projection $\ker A\to P_0$ is onto iff every $A(v,0)$ can be cancelled by an $A(0,w)$. Because the total map is onto, this is equivalent to surjectivity of $A(0,\cdot)$, precisely slice transversality. (b) The projection kernel is $L^{-1}(V)$, dimension $\dim\ker L+\dim(\operatorname{ran}L\cap V)$. Its cokernel identifies with $N_0/(\operatorname{ran}L+V)$, dimension $\dim\operatorname{coker}L-\dim V+\dim(\operatorname{ran}L\cap V)$. Subtraction gives $\operatorname{ind}L+\dim V$. The split submersion and Fredholm hypotheses guarantee the Banach submanifold and closed-range assertions. (c) Each double point identifies two distinct domain points, so injectivity fails even if the crossing is transverse. Strong Whitney supplies an embedding in $\mathbb R^{2n}$ for compact $n\ge1$. Its proof needs a construction that removes double points, with Whitney disks, framing/sign control and additional treatment of low dimensions; Sard alone only puts intersections in general position. The source offers a sketch in Lectures 21–22, not a complete all-dimensions proof. A complete response acknowledges that boundary and does not assert every immersion can be changed through embeddings.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

### MAT-261-u10 — The Lie derivative, the Frobenius theorem and foliations

Objectives: Compute Lie brackets and Lie derivatives using local flows with a consistent sign convention.; Prove the constant-rank Frobenius theorem by commuting adapted vector fields and distinguish integral leaves from embedded submanifolds.; Use the codimension-one criterion, compute holonomy in a suspension example, and state the scope of local and global Reeb stability.

#### MAT-261-u10-ex1: Bracket, flow, and a failed surface

Prompt: For $X=\partial_x+y\partial_z$ and $Y=\partial_y$ on $\mathbb R^3$, compute both flows and $[X,Y]$. Calculate the effect of the four moves: flow along $X$ for $s$, along $Y$ for $t$, along $X$ for $-s$, then along $Y$ for $-t$. Use this and the Frobenius criterion to decide whether their rank-two span is integrable.

Instructor reference: `content/courses/MAT-261/units/10-lie-derivative-frobenius-and-foliations/instructor/MAT-261-u10-ex1.reference-solution.md`.

# Bracket, flow, and a failed surface — reference reasoning

The $X$ flow is $(x,y,z)\mapsto(x+s,y,z+sy)$ and the $Y$ flow is $(x,y+t,z)$. The bracket is $-\partial_z$. The four moves take $(x,y,z)$ successively to $(x+s,y,z+sy)$, $(x+s,y+t,z+sy)$, $(x,y+t,z-st)$, and $(x,y,z-st)$. The net vertical displacement is $-st$, consistent with the stated ordering and bracket. A combination $aX+bY$ has horizontal components $(a,b)$, so a purely vertical nonzero vector cannot be in the span. The distribution is not involutive and hence not integrable. Small allowed motions can generate displacement outside the original plane; this does not mean the bracket itself was an allowed instantaneous direction.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u10-ex2: A foliation by curved graphs

Prompt: Let $q(x,y,z)=z/(1+x^2+y^2)$ and $D=\ker dq$. Produce a global frame for $D$, verify its bracket vanishes, and identify its leaves. Then compare with $\eta=dz-y\,dx$: compute $\eta\wedge d\eta$ and relate the answer to the preceding exercise.

Instructor reference: `content/courses/MAT-261/units/10-lie-derivative-frobenius-and-foliations/instructor/MAT-261-u10-ex2.reference-solution.md`.

# A foliation by curved graphs — reference reasoning

Put $h=1+x^2+y^2$. Since $q_z=1/h$, the kernel has rank 2. A frame is $X=\partial_x+(2xz/h)\partial_z$, $Y=\partial_y+(2yz/h)\partial_z$. Both annihilate $q$. Their bracket is vertical and belongs to $\ker dq$ because $[X,Y]q=0$, so it vanishes (one may also differentiate coefficients). Each level $q=c$ is the connected graph $z=c(1+x^2+y^2)$; these exhaust the maximal leaves since $q$ is constant along any tangent path. For $\eta=dz-y dx$, $d\eta=-dy\wedge dx=dx\wedge dy$, so $\eta\wedge d\eta=dz\wedge dx\wedge dy=dx\wedge dy\wedge dz\ne0$. Its kernel is the nonintegrable span of the preceding exercise.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u10-ex3: A compact leaf with nontrivial holonomy

Prompt: For the suspension $(t+1,y)\sim(t,2y)$ with horizontal foliation, compute the holonomy germ of the leaf $y=0$. Prove that no saturated neighbourhood of that leaf can be diffeomorphic as a foliation to the product of a circle with an interval of circle leaves. Explain which hypothesis of local Reeb stability is absent and why the global sphere-leaf theorem is also unavailable.

Instructor reference: `content/courses/MAT-261/units/10-lie-derivative-frobenius-and-foliations/instructor/MAT-261-u10-ex3.reference-solution.md`.

# A compact leaf with nontrivial holonomy — reference reasoning

Starting at $(0,y)$, horizontal travel to $(1,y)$ is identified with $(0,2y)$, so the return germ is $h(y)=2y$. Its iterates $2^ky$ are all distinct as germs, giving infinite holonomy. In a product foliation by circles the return holonomy is the identity. Foliated diffeomorphisms conjugate holonomy germs, and a nonidentity germ cannot be conjugated to the identity. Hence no such product neighbourhood exists. The leaf is compact but its holonomy is infinite, so the finite-holonomy premise of local Reeb stability fails. The total suspension is two-dimensional and the compact leaf is $S^1$, not an $S^2$ leaf in a closed three-manifold; the global theorem does not apply. Positivity of 2 does provide transverse orientation, but that alone is insufficient.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u10-ex4: Frobenius from adapted fields to global limits

Prompt: Prove the local Frobenius theorem for a smooth constant-rank distribution using the graph-form frame $X_i$ in the lesson. Explain why involutivity makes those fields commute and how their flows form coordinates. Complete your account with the irrational-slope torus example: establish injectivity and density of a leaf, and explain why neither a global embedded leaf nor a Hausdorff leaf space follows from the local theorem. Relate this limitation to what holonomy and Reeb stability add.

Instructor reference: `content/courses/MAT-261/units/10-lie-derivative-frobenius-and-foliations/instructor/MAT-261-u10-ex4.reference-solution.md`.

# Frobenius from adapted fields to global limits — reference reasoning

Choose coordinates making horizontal projection on the rank-r distribution invertible near the point. The unique graph frame has fixed horizontal components $e_i$. Its brackets therefore have zero horizontal component. Involutivity puts them in the distribution, so uniqueness of graph representation forces zero. Zero bracket makes each field invariant under the other local flows, hence these flows commute by uniqueness. Composing them from a transverse slice produces a map with invertible derivative; the inverse theorem yields coordinates and commutation identifies the coordinate directions with the frame. Necessity follows immediately in adapted coordinates. On the torus, equality of two points along the line implies time difference $m\in\mathbb Z$ and $\alpha m\in\mathbb Z$, forcing $m=0$ for irrational $\alpha$. The irrational rotation subgroup is dense, so every transverse circle is met densely and the whole leaf is dense. It cannot be embedded with its intrinsic line topology: return times approach a point in the torus while escaping in the line parameter. All leaves are dense, so a nonempty saturated open set contains all leaves and is the whole torus; the leaf quotient with more than one point is not Hausdorff. Holonomy studies returns along loops; Reeb adds compact-leaf/finite-holonomy hypotheses for a saturated neighbourhood. The dense line is noncompact and is outside that theorem.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

### MAT-261-u11 — Differential forms, the Poincaré lemma and de Rham cohomology

Objectives: Compute wedge products, pullbacks and exterior derivatives with consistent signs, and prove d²=0 and naturality.; Construct the homotopy operator, prove the Poincaré lemma on a star-shaped domain, and deduce homotopy invariance.; Distinguish local exactness from global exactness by computing periods and the first de Rham cohomology of a punctured plane.

#### MAT-261-u11-ex1: Pullback and differentiation commute in a calculation

Prompt: For $F(r,\theta)=(r\cos\theta,r\sin\theta)$ on $(0,\infty)\times\mathbb R$ and $\eta=x\,dy-y\,dx$, calculate $F^*\eta$, $d(F^*\eta)$ and $F^*(d\eta)$. Evaluate the integral of $\eta$ around the positively oriented circle of radius $R$. State why the pullback calculation does not create a globally defined angle function on the punctured plane.

Instructor reference: `content/courses/MAT-261/units/11-differential-forms-and-de-rham-cohomology/instructor/MAT-261-u11-ex1.reference-solution.md`.

# Pullback and differentiation commute in a calculation — reference reasoning

Substitute $dx=\cos\theta dr-r\sin\theta d\theta$ and $dy=\sin\theta dr+r\cos\theta d\theta$ to obtain $F^*\eta=r^2d\theta$. Thus $dF^*\eta=2r\,dr\wedge d\theta$. Meanwhile $d\eta=dx\wedge dy-dy\wedge dx=2dx\wedge dy$, whose pullback is the same. On $r=R$ the integral is $\int_0^{2\pi}R^2d\theta=2\pi R^2$. The polar map on the full real angle coordinate is a covering and not injective; adding $2\pi$ gives the same point, so the coordinate $\theta$ does not descend to a real-valued smooth function.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u11-ex2: Use the radial primitive, including the endpoint

Prompt: On $\mathbb R^3$, let $\alpha=(2xy+z)\,dx+x^2\,dy+x\,dz$. Verify that it is closed. Apply the radial homotopy formula for one-forms to construct a primitive, and verify by direct differentiation. Explain what the same homotopy identity says for closed zero-forms.

Instructor reference: `content/courses/MAT-261/units/11-differential-forms-and-de-rham-cohomology/instructor/MAT-261-u11-ex2.reference-solution.md`.

# Use the radial primitive, including the endpoint — reference reasoning

The cross derivatives agree: $\partial_y(2xy+z)=2x=\partial_x(x^2)$, $\partial_z(2xy+z)=1=\partial_x(x)$, and the remaining cross derivatives are 0. The radial formula gives $K\alpha(x,y,z)=\int_0^1[(2t^2xy+tz)x+t^2x^2y+txz]dt=\int_0^1(3t^2x^2y+2txz)dt=x^2y+xz$. Differentiation recovers $\alpha$. At the origin the integral is well-defined and smooth; there is no excluded endpoint singularity. For a function $f$, the identity says $f(x)-f(0)=K(df)$, so $df=0$ implies $f$ is constant. There are no degree $-1$ forms giving a primitive of a nonzero constant.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u11-ex3: Periods under a winding map

Prompt: For the angular form $\omega$ in the lesson, compute its pullback by $\gamma_k(t)=(\cos kt,\sin kt)$, $0\le t\le2\pi$, for every integer $k$. Prove $\omega$ is not exact, and determine the induced map on $H^1_{\mathrm{dR}}(S^1)$ of the map $e^{it}\mapsto e^{ikt}$ once the circle period class is used as a basis. Include $k=0$ and negative $k$.

Instructor reference: `content/courses/MAT-261/units/11-differential-forms-and-de-rham-cohomology/instructor/MAT-261-u11-ex3.reference-solution.md`.

# Periods under a winding map — reference reasoning

Substitution gives $\gamma_k^*\omega=k\,dt$, so the integral is $2\pi k$, including 0 for $k=0$ and a negative integral for negative winding. At $k=1$ the nonzero period rules out exactness because an exact pullback is the differential of a periodic function and integrates to zero. A closed one-form on $S^1$ lifts to $a(t)dt$ with $2\pi$-periodic $a$; subtract its mean multiple of $dt$ and integrate the zero-mean remainder to get a periodic primitive. Thus $H^1(S^1)$ has basis the angular class and the winding map multiplies it by $k$. The constant map induces zero in positive degree.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u11-ex4: Classify all closed one-forms on the punctured plane

Prompt: Let $\alpha$ be a smooth closed one-form on $\mathbb R^2\setminus\{0\}$. Pull it back to $(0,\infty)\times\mathbb R$ as $A(r,\theta)dr+B(r,\theta)d\theta$. Prove the period $c(r)=\int_0^{2\pi}B(r,\theta)d\theta$ is constant. Construct a primitive on the covering, determine its change under $\theta\mapsto\theta+2\pi$, and conclude $\alpha-(c/2\pi)\omega$ is exact. State all de Rham groups of the punctured plane, justifying the higher-degree assertion by a deformation retraction and the homotopy operator.

Instructor reference: `content/courses/MAT-261/units/11-differential-forms-and-de-rham-cohomology/instructor/MAT-261-u11-ex4.reference-solution.md`.

# Classify all closed one-forms on the punctured plane — reference reasoning

The coefficients are periodic in $\theta$, and closedness says $\partial_rB=\partial_\theta A$. Hence $c'(r)=A(r,2\pi)-A(r,0)=0$. Define $P(r,\theta)=\int_1^rA(s,0)ds+\int_0^\theta B(r,t)dt$. Differentiating gives $P_\theta=B$ and $P_r=A(r,0)+\int_0^\theta\partial_tA(r,t)dt=A(r,\theta)$, so $dP$ is the lifted form. Its angular increment is $c$. Thus $P-(c/2\pi)\theta$ is periodic and descends to a smooth function on the punctured plane, proving the stated exactness. Nonzero period of $\omega$ shows the class is nonzero and yields $H^1\cong\mathbb R$. Connectedness gives $H^0\cong\mathbb R$. The smooth homotopy $(r,\theta)\mapsto((1-t)r+t,\theta)$ is well-defined downstairs and retracts onto the unit circle. The homotopy identity gives isomorphic cohomology, and the circle has no forms of degree $\ge2$, so all those groups vanish. Local exactness alone would not establish these global statements.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u11-ex5: Proof portfolio: the homotopy identity and Poincaré lemma

Prompt: Let $H:[0,1]\times M\to N$ be a smooth homotopy and $\omega\in\Omega^k(N)$. Derive the homotopy identity and prove Poincaré rather than quoting the radial formula. You may use the coordinate definition of exterior differentiation, its graded product rule, and naturality $dH^*=H^*d$ proved earlier in this unit.

1. Explain the unique decomposition $H^*\omega=\alpha(t)+dt\wedge\beta(t)$ into forms on $M$. Derive the formula for its exterior derivative on $[0,1]\times M$, including the sign of $d_M\beta$.
2. Define a degree-minus-one operator $K$ by integrating the $dt$ component and prove $d_MK+Kd_N=H_1^*-H_0^*$ as an identity on all forms. Treat degree zero explicitly rather than introducing nonexistent negative-degree forms.
3. Deduce homotopy invariance on de Rham cohomology. For a star-shaped open set $U\subset\mathbb R^n$ containing zero, use $H(t,x)=tx$ to derive the integral formula for $K\omega$ and prove every closed positive-degree form is exact. State the correct degree-zero conclusion.
4. Explain which parts of the proof fail if a domain is not contractible, using the angular one-form on the punctured plane. Show why it is locally exact but has no global primitive. In this example distinguish the existence of a radial deformation retraction onto a circle from a contraction to a point.
5. Identify how this proof supplies column exactness in the Čech–de Rham double complex in the next unit, and distinguish it from the partition-of-unity argument supplying row exactness.

Instructor reference: `content/courses/MAT-261/units/11-differential-forms-and-de-rham-cohomology/instructor/MAT-261-u11-ex5.reference-solution.md`.

# Proof portfolio: the homotopy identity and Poincaré lemma — reference reasoning

## 1. Decomposing a pulled-back form

At $(t,x)$ the tangent space is $\mathbb R\partial_t\oplus T_xM$. An alternating covector separates uniquely into terms with no $dt$ factor and terms with exactly one $dt$ factor (terms with two vanish). Restriction to the slice gives $\alpha(t)$, and contraction with $\partial_t$ followed by slice restriction gives $\beta(t)$. In coordinates, the smooth coefficients therefore give a unique smooth family decomposition $H^*\omega=\alpha+dt\wedge\beta$.

The derivative of the first part is $d_M\alpha+dt\wedge\partial_t\alpha$. For the second, $d(dt)=0$ and the degree-one product rule give $d(dt\wedge\beta)=-dt\wedge d\beta=-dt\wedge d_M\beta$, since the remaining term contains $dt\wedge dt$. Hence
$$dH^*\omega=d_M\alpha+dt\wedge(\partial_t\alpha-d_M\beta).$$
This sign is essential: replacing the minus by a plus would not give the operator identity below.

## 2. Integrating the time component

For $k\ge1$, define $K\omega=\int_0^1\beta(t)\,dt$. Integration of smooth coefficient functions on a compact parameter interval yields a smooth $(k-1)$-form and commutes with spatial differentiation, locally by the ordinary differentiation-under-the-integral theorem. Naturality gives $H^*(d_N\omega)=dH^*\omega$, so the displayed $dt$ coefficient implies
$$K(d_N\omega)=\int_0^1\partial_t\alpha\,dt-\int_0^1d_M\beta\,dt=H_1^*\omega-H_0^*\omega-d_MK\omega.$$
Rearranging proves $d_MK\omega+K(d_N\omega)=H_1^*\omega-H_0^*\omega$.

For $k=0$, set $K\omega=0$. There is no $\beta$ for a zero-form, but the $dt$ coefficient of $dH^*\omega$ is $\partial_t(H^*\omega)$. Thus $K(d\omega)=H_1^*\omega-H_0^*\omega$ by the fundamental theorem, and the same identity holds with the first term zero. No negative-degree primitive is claimed.

## 3. Cohomology and the star-shaped primitive

If $d\omega=0$, the identity says $H_1^*\omega-H_0^*\omega=d(K\omega)$, so the two pullbacks represent the same cohomology class. Pullback already commutes with $d$, making its map on cohomology well-defined; consequently homotopic maps induce the same map.

For $H(t,x)=tx$, its derivative sends $\partial_t$ to $x$ and a spatial tangent vector $v$ to $tv$. Therefore for $k\ge1$,
$$\beta(t)_x(v_1,\ldots,v_{k-1})=t^{k-1}\omega_{tx}(x,v_1,\ldots,v_{k-1}),$$
and integrating gives the radial formula. Star-shapedness ensures $tx\in U$ for every required $t$ and $x$; smoothness at $t=0$ follows directly from the pulled-back form (there is no negative power when $k\ge1$). Now $H_1$ is the identity and $H_0$ is the constant map at zero. Its derivative vanishes, so $H_0^*\omega=0$ for positive-degree forms. For a closed such form, the homotopy identity gives $\omega=dK\omega$, proving Poincaré on $U$.

For a function $f$, the constant-map pullback is instead the constant function $f(0)$, so $f-f(0)=K(df)$. If $df=0$, $f$ is constant. Thus $H^0(U)=\mathbb R$ for the nonempty star-shaped domain, not zero; the positive-degree exactness statement does not extend to degree zero. The same identity works for any explicit smooth contraction, not only radial ones.

## 4. Local exactness is not global exactness

On the punctured plane the angular form $\eta=(-y\,dx+x\,dy)/(x^2+y^2)$ pulls back in any angle chart to $d\theta$, so is closed and locally exact. On the positively oriented unit circle its pullback is $d\theta$ and its integral is $2\pi$. If $\eta=df$ globally, its circle pullback would be the differential of a periodic function and its integral would be zero, a contradiction.

Radial interpolation to radius one, $(r,\theta)\mapsto((1-t)r+t,\theta)$, is a valid deformation retraction onto the circle: its radius remains positive. It gives equal cohomology with the circle, not with a point. Scaling to zero, $(r,\theta)\mapsto((1-t)r,\theta)$, leaves the punctured domain at $t=1$, so the contraction needed to make the endpoint map constant inside the domain does not exist. The general homotopy identity itself remains valid for any homotopy that is actually defined; it is the proposed contraction that fails here.

## 5. The two different exactness directions

On each smoothly contractible finite intersection in a good cover, the homotopy proof shows closed positive-degree forms have primitives, while the degree-zero kernel consists of locally constant functions. This is the column exactness for the exterior differential $d$ in the Čech–de Rham double complex. The row differential is the overlap coboundary $\delta$. Its positive-degree acyclicity for smooth-form coefficients comes from the separate partition homotopy $\delta K_{\mathrm{Cech}}+K_{\mathrm{Cech}}\delta=I$. These are different operators in different directions. Poincaré does not assert every global closed form is exact, and the partition homotopy does not preserve the sheaf of locally constant functions.

## Marking boundary

This is one complete route, not an exhaustive template. Accept a correct alternative proof with every named obligation met. Quoting the theorem being proved is not evidence for its proof; previously established lemmas may be used when the prompt allows them. Track assistance and the first substantive gap. Author self-review has not been substituted for independent academic review.

### MAT-261-u12 — Čech cohomology, Stokes' theorem and the de Rham theorem

Objectives: Define the Čech differential and refinement maps, compute a cover cohomology, and prove acyclicity for the sheaf of smooth forms using a partition of unity.; Prove the Čech–de Rham comparison on good covers through the two exact directions of the double complex, stating the good-cover input.; Apply orientation and Stokes with the induced boundary signs, and synthesize the comparison on the sphere using a concrete good cover and a nonexact area form.

#### MAT-261-u12-ex1: The circle class from two local angles

Prompt: Let $U=S^1\setminus\{(-1,0)\}$ and $V=S^1\setminus\{(1,0)\}$. Use angle branches $\theta_U\in(-\pi,\pi)$ and $\theta_V\in(0,2\pi)$. Compute their difference on both components of $U\cap V$, write the Čech complex with locally constant coefficients, and compute its cohomology. Relate the nonzero overlap class to the period of the angular one-form. Explain why one constant for the whole overlap is insufficient.

Instructor reference: `content/courses/MAT-261/units/12-cech-cohomology-and-the-de-rham-theorem/instructor/MAT-261-u12-ex1.reference-solution.md`.

# The circle class from two local angles — reference reasoning

On the upper semicircle the two branches agree; on the lower, $\theta_V-\theta_U=2\pi$. Thus the cocycle is $(0,2\pi)$ when the components are ordered upper/lower. Connectedness of each arc gives $C^0=\mathbb R^2$, while the two overlap components give $C^1=\mathbb R^2$; there are no increasing-index triple intersections. With $\delta(a,b)=(b-a,b-a)$, the kernel is diagonal $\mathbb R$ and the cokernel is $\mathbb R^2/\operatorname{span}(1,1)\cong\mathbb R$, detected by lower minus upper value. The angular form has local primitives $\theta_U,\theta_V$ and period $2\pi$, matching the jump. The intersection is not connected, so locally constant need not mean globally constant there. Although this cover is not a good cover under the connected-contractible definition, each overlap component is contractible and its positive-degree form cohomology vanishes, so the same column argument computes the real de Rham groups.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u12-ex2: Prove the partition homotopy

Prompt: For alternating smooth $q$-form cochains of positive Čech degree, define $K$ as in the lesson. Prove $\delta K+K\delta=I$, including the support and local-finiteness justification. Deduce that a Čech cocycle with smooth-form coefficients is a coboundary. Explain why this proof does not show that $\check H^1(S^1;\mathbb R)=0$.

Instructor reference: `content/courses/MAT-261/units/12-cech-cohomology-and-the-de-rham-theorem/instructor/MAT-261-u12-ex2.reference-solution.md`.

# Prove the partition homotopy — reference reasoning

For $c$ of degree $p\ge1$, $(\delta Kc)_{i_0\ldots i_p}=\sum_j\rho_j\sum_{a=0}^p(-1)^a c_{j i_0\ldots\widehat{i_a}\ldots i_p}$. On the other hand,$(K\delta c)_{i_0\ldots i_p}=\sum_j\rho_j[c_{i_0\ldots i_p}+\sum_{a=0}^p(-1)^{a+1}c_{j i_0\ldots\widehat{i_a}\ldots i_p}]$. The inner sums cancel, leaving $\sum_j\rho_jc=c$. A term defined only on $U_j$ extends by zero because $\operatorname{supp}\rho_j\subset U_j$; local finiteness makes the sum and cancellation legitimate in a neighbourhood. For $\delta c=0$, $c=\delta(Kc)$. The homotopy uses multiplication by nonconstant smooth functions, so $K$ need not preserve locally constant cochains. It proves acyclicity of the sheaf of smooth forms, not of the constant sheaf.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u12-ex3: Stokes on an annulus and a disk

Prompt: On the oriented planar annulus $A=\{1\le x^2+y^2\le4\}$ let $\omega=(-y\,dx+x\,dy)/(x^2+y^2)$ and $\eta=x\,dy-y\,dx$. Compute $d\omega,d\eta$, and both boundary integrals with the induced orientations. Explain why applying Stokes to $\omega$ on the whole disk of radius 2 is invalid, whereas it is valid for $\eta$.

Instructor reference: `content/courses/MAT-261/units/12-cech-cohomology-and-the-de-rham-theorem/instructor/MAT-261-u12-ex3.reference-solution.md`.

# Stokes on an annulus and a disk — reference reasoning

On the annulus,$d\omega=0$ and $d\eta=2dx\wedge dy$. The outer circle has counterclockwise orientation, the inner clockwise. The two $\omega$ integrals are $2\pi,-2\pi$, summing 0. The two $\eta$ integrals are $8\pi,-2\pi$, summing $6\pi$, equal to $2\operatorname{area}(A)=2(4\pi-\pi)$. The angular form is undefined at the origin and cannot be used as a smooth form on the disk; its apparent boundary integral $2\pi$ is no contradiction. The polynomial form $\eta$ is smooth on that disk, and its outer integral $8\pi$ equals $\int_{D_2}2dxdy=8\pi$. The domain in the inequality is an annulus of radii 1 and 2, not squared radii 1 and 4 interpreted as radii.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.

#### MAT-261-u12-ex4: Capstone: the sphere through local primitives and integration

Prompt: Write a complete connected account of the Čech–de Rham theorem, illustrated on $S^2$. (a) Verify that the four tetrahedral hemispheres in the lesson form a good cover with all triple intersections nonempty and empty fourfold intersection. Compute the two coboundary ranks and all cover cohomology groups. (b) Establish the comparison via the double complex: prove row acyclicity by the partition homotopy, state the column exactness supplied by Poincaré, specify the total sign, and explain the finite elimination argument. For a closed two-form $\sigma$, describe local one-form primitives $\eta_i$, overlap functions $f_{ij}$, and the constant triple-overlap cocycle they produce; show its class is independent of the choices. (c) Compute $\int_{S^2}\Omega$, prove $\Omega$ is not exact, and identify the real cohomology generator. State which inputs are proved in this course, which covering result is assumed for a general manifold, and why this real theorem does not identify integer torsion.

Instructor reference: `content/courses/MAT-261/units/12-cech-cohomology-and-the-de-rham-theorem/instructor/MAT-261-u12-ex4.reference-solution.md`.

# Capstone: the sphere through local primitives and integration — reference reasoning

(a) The tetrahedral vectors span $\mathbb R^3$ and sum to zero. If a point were outside all four open hemispheres, all dot products would be nonpositive with zero sum, hence all zero, impossible. A nonempty intersection of open hemispheres has no antipodal pair and is closed under normalised convex interpolation with any fixed interior point: every required dot product stays positive, so the denominator never vanishes. This gives a smooth contraction. For an omitted index $l$, $-v_l$ has dot product $1/3$ with the other three vectors, proving all triple (and hence all pair) intersections nonempty. Four positive dot products cannot sum to zero. Thus the complex has dimensions 4,6,4. The kernel of $\delta^0$ consists of equal vertex values, so rank 3. A 1-cocycle obeys $c_{ij}=c_{0j}-c_{0i}$ using each triangle containing vertex 0 (take $c_{00}=0$); hence it is a vertex coboundary and the kernel of $\delta^1$ has dimension 3. Thus rank $\delta^1=6-3=3$, giving $H^0=\mathbb R$, $H^1=0$, $H^2=\mathbb R$, higher groups 0. The functional $b_{123}-b_{023}+b_{013}-b_{012}$ annihilates $\operatorname{im}\delta^1$ and detects its one-dimensional cokernel.

(b) Use $C^{p,q}$ and $D=\delta+(-1)^p d$. Restrictions commute with $d$, so the sign cancels mixed terms and $D^2=0$. The partition identity proved in the preceding exercise makes the augmented rows exact beyond the global forms in degree 0. On each good-cover intersection the homotopy formula makes the augmented columns exact beyond locally constant degree-zero functions. Eliminate the largest horizontal degree in a closed total cochain using a horizontal primitive; subtraction of its total differential creates only lower horizontal degree. Repetition leaves a global closed form. The same argument applied to total boundaries proves injectivity of the induced comparison. Eliminating largest vertical degree instead, with the appropriate $(-1)^p$ sign for its primitive, leaves a locally constant Čech cocycle, with the same boundary argument. Each diagonal has finitely many bidegrees, so no infinite-convergence assumption is concealed. This gives both isomorphisms with total cohomology.

For a closed 2-form $\sigma$, choose $d\eta_i=\sigma|_{U_i}$ by Poincaré. On each overlap choose $df_{ij}=\eta_j-\eta_i$, with $f_{ji}=-f_{ij}$. Then $c_{ijk}=f_{jk}-f_{ik}+f_{ij}$ has zero differential and is constant on the connected triple intersection; $\delta c=0$. If $\eta'_i$ is another choice, its difference is $dg_i$ on $U_i$. Then $f'_{ij}=f_{ij}+g_j-g_i+k_{ij}$ for constants $k_{ij}$, so $c'=c+\delta k$. Changing $\sigma$ by $d\lambda$ permits replacing every $\eta_i$ by $\eta_i+\lambda$, leaving the cocycle class unchanged. These checks make the construction well-defined on de Rham classes; the double-complex proof supplies bijectivity.

(c) Parametrize the sphere away from its polar singularities by $(\sin\theta\cos\phi,\sin\theta\sin\phi,\cos\theta)$, $0<\theta<\pi$, $0<\phi<2\pi$. For the outward orientation the pullback of $\Omega$ is $\sin\theta\,d\theta\wedge d\phi$, giving integral $4\pi$ by integrating and taking the harmless endpoint limits. The omitted curves have area zero and can equivalently be handled by chart partitions. As a top form on a 2-manifold,$d\Omega=0$. If $\Omega=d\beta$, Stokes on the closed sphere gives integral 0, a contradiction. Part(a) and the comparison say $H^2$ is one-dimensional, so $[\Omega/(4\pi)]$ is the unique generator with integral 1 under the integration identification. The course proved Poincaré by the homotopy operator, partition acyclicity, the comparison algebra and the Stokes mechanism; the existence of cofinal good covers for general smooth manifolds is the stated geometric input, not needed abstractly for this explicit sphere cover. Coefficients throughout are real, so no integer torsion information is claimed.

## Marking boundary
Accept any logically complete alternative argument. Numerical experiments or matching phrases do not establish a proof. Diagnose the first substantive gap, distinguish a slip from a false premise, and do not infer mastery of the whole unit from this question alone. This is an authored reference, not an independently certified oracle.
