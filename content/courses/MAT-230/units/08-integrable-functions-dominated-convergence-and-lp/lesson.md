# Integrable functions, dominated convergence and Lᵖ

The nonnegative integral deliberately allowed infinity. To subtract positive and negative contributions safely, require $\int|f|<\infty$. This is absolute integrability; it rules out the undefined expression $\infty-\infty$. For complex functions integrate real and imaginary parts. Linearity and $|\int f|\le\int|f|$ then make integration a bounded linear measurement on $L^1$.

Read MIT 18.102 [Lecture 12](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/e407e57ea631a29148ee94afecef7d33_MIT18_102s21_lec12.pdf), especially dominated convergence, and [Lecture 13](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/aad5fcf3b0f85788519a0324258dd296_MIT18_102s21_lec13.pdf), Hölder, Minkowski and Riesz–Fischer. The proof of Hölder from the scalar Young inequality is assigned reading; check the normalisation and the zero-norm case separately.


**Source-reading correction (Lecture 13, Corollary 137).** The displayed decay assumption must be the upper bound $|f(x)|\le C(1+|x|)^{-q}$ with $q>1$, not the printed lower bound. For $1\le p<\infty$, the upper bound gives $\int_{\mathbb R}|f|^p\le 2C^p/(pq-1)<\infty$; it also bounds the essential supremum. The constant function one satisfies the printed lower bound with $C=1$ but is not in any finite-$p$ space on $\mathbb R$. Use the corrected direction while reading the proof.


## Domination controls escaping mass

Suppose $f_n\to f$ almost everywhere and $|f_n|\le g$ for every $n$ outside a null set, where $g\in L^1$ is fixed. Then $|f|\le g$ and $\int|f_n-f|\to0$. One proof applies Fatou to $2g-|f_n-f|\ge0$; it yields $2\int g\le2\int g-\limsup\int|f_n-f|$, forcing the nonnegative last integrals to zero. Thus $\int f_n\to\int f$ too. The same argument works for complex functions through absolute values.

**Worked example.** For $a\in[-1/2,1/2]$, consider $I(a)=\int_0^1x^a\,dx$. To differentiate at zero, the mean value theorem gives $(x^h-1)/h=x^\xi\log x$ with $\xi$ between zero and $h$. Its absolute value is bounded by $x^{-1/2}|\log x|$, an integrable function. Dominated convergence gives $I'(0)=\int_0^1\log x\,dx=-1$, agreeing with differentiation of $1/(1+a)$. Merely writing a derivative under the integral would omit the essential justification.

## Norms of equivalence classes

For $1\le p<\infty$, set $\|f\|_p=(\int|f|^p)^{1/p}$; for $p=\infty$, use the essential supremum, the smallest almost-everywhere upper bound. Identify functions equal almost everywhere. Otherwise $\|f\|_p=0$ need not imply $f=0$ as a pointwise function. A representative's value at one point therefore cannot be recovered from its $L^p$ class.

If $1/p+1/q=1$, Hölder says $\int|fg|\le\|f\|_p\|g\|_q$. The endpoint $(p,q)=(1,\infty)$ follows by the essential bound; for interior exponents, normalise and integrate Young's inequality $uv\le u^p/p+v^q/q$. Minkowski, $\|f+g\|_p\le\|f\|_p+\|g\|_p$, follows directly from the pointwise triangle inequality for $p=1$ (and the essential supremum for $p=\infty$). For $1<p<\infty$, first use $|f+g|^p\le2^{p-1}(|f|^p+|g|^p)$ to establish $f+g\in L^p$. Apply Hölder to $|f+g|^{p-1}|f|$ and $|f+g|^{p-1}|g|$, and divide by the now finite $\|f+g\|_p^{p-1}$ when it is nonzero; the zero case is immediate. These are the estimates making $L^p$ a normed linear space.

**Worked example.** On a finite-measure set $E$, Hölder applied to $|f|^p\cdot1$ gives, for $q>p$,
$$\|f\|_p\le m(E)^{1/p-1/q}\|f\|_q.$$
The case $q=\infty$ follows directly. The domain-size factor is part of the theorem. On the whole real line there is no general inclusion in either direction; near-zero singularities and long tails behave differently.

## Why these spaces are complete

Let $(f_n)$ be Cauchy in $L^p$, $p<\infty$. Choose a subsequence with $\|f_{n_{k+1}}-f_{n_k}\|_p\le2^{-k}$. Put $g_N=\sum_{k\le N}|f_{n_{k+1}}-f_{n_k}|$. Minkowski bounds $\|g_N\|_p\le1$. Monotone convergence shows $g=\lim g_N$ lies in $L^p$, hence is finite almost everywhere. Thus the telescoping series of differences converges absolutely almost everywhere to a measurable limit $f-f_{n_1}$.

The tail estimate, or dominated convergence with bound $g^p$, shows $\|f_{n_k}-f\|_p\to0$. The Cauchy property then brings the whole sequence to the same limit. For $p=\infty$, outside the countable union of exceptional null sets the Cauchy bounds hold pointwise uniformly; the uniform-limit argument gives an essentially bounded limit and norm convergence. Completeness belongs to the equivalence-class space, not to a preferred pointwise representative.

## Three convergences to keep apart

Norm convergence in $L^p$, $p<\infty$, guarantees an almost-everywhere convergent subsequence, not in general convergence of the full sequence pointwise. A typewriter sequence sweeps dyadic intervals across $[0,1)$: its indicator norms tend to zero, yet each point is hit and missed infinitely often. Conversely pointwise convergence need not imply norm convergence, as narrowing spikes of increasing height show. Uniform convergence on a finite-measure domain implies every finite-$p$ norm convergence, with the domain-size bound above.

The exercises turn these distinctions into explicit calculations. A complete answer includes the measure space and exponent range before invoking an inequality. Later Hilbert-space arguments specialise to $p=2$, where the norm comes from an inner product and a new geometric toolkit becomes available.

## Assessed proof work

Exercise 4 is an assessed completeness proof for every exponent from 1 through infinity. It requires the full summable-subsequence argument for finite exponents and a separate common-null-set/uniform-Cauchy argument for infinity, rather than inferring proof ability from power-function calculations.
