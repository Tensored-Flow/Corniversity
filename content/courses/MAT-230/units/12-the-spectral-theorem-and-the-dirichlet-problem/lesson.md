# Spectral theorem and the Dirichlet problem

This is the course's synthesis: complete spaces provide limits, inner products provide orthogonality, compactness produces convergent subsequences, and spectral expansions turn a boundary-value problem into a controlled infinite system. The aim is to justify both the existence of a solution and the mode in which approximations approach it.

Read MIT 18.102 Lectures [21](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/345c4a5141559a4069aeb3105acd8ef3_MIT18_102s21_lec21.pdf), [22](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/57596554e180e442c9487f580303147b_MIT18_102s21_lec22.pdf), and [23](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/9f0f59147c3235d57eacca9157faf834_MIT18_102s21_lec23.pdf). **Source correction:** the kernel printed in Lecture 23, Theorem 235, has the opposite sign to the inverse of $-u''$ stated there. We use the positive kernel below and verify it directly. This is recorded in this course's correction ledger; do not memorise a sign from a citation.


**Source-reading correction (Lecture 23, Theorem 241 proof).** Multiplication $M_V$ by a continuous real potential is bounded and self-adjoint; it need not be compact. For $V=1$ it is the identity on infinite-dimensional $L^2$. Compactness of $G^{1/2}M_VG^{1/2}$ comes from the compact Green square-root factors and boundedness of $M_V$, as used below. Do not import the source proof's accidental claim that $M_V$ itself is compact.


## What the spectral theorem actually says

For compact self-adjoint $K$ on a separable Hilbert space, nonzero eigenvalues are real, have finite multiplicities, and can accumulate only at zero. There is an orthonormal basis consisting of eigenvectors for nonzero eigenvalues together with an orthonormal basis for $\ker K$. Thus
$$Kx=\sum_j\lambda_j\langle x,e_j\rangle e_j.$$
The nonzero eigenvectors span $\overline{\operatorname{ran}K}=(\ker K)^\perp$ after closure; the range itself need not be closed. The series converges in norm. Truncation at decreasing absolute eigenvalues gives operator-norm error at most the next absolute eigenvalue.

Here is the proof architecture to reconstruct from Lectures 21–22. Self-adjointness makes distinct eigenspaces orthogonal. Compactness forbids infinitely many orthogonal eigenvectors whose eigenvalues stay bounded away from zero. For $\lambda\ne0$, compactness also gives a lower bound for $K-\lambda I$ on the orthogonal complement of its kernel: otherwise normalised approximate null vectors, and a convergent image subsequence, yield a nonzero vector simultaneously in the kernel and its complement. This gives closed range and the Fredholm alternative. A nonzero compact self-adjoint operator attains its extremal spectral magnitude at an eigenvector. Repeat on orthogonal complements; the remaining operator norm tends to zero, or the construction would violate compactness. These steps prove completeness of the eigen-expansion. The extremal-eigenvector lemma and its quadratic-form argument are required source reading, not assumed to follow from finite-dimensional diagonalisation.

## Worked example: build an inverse with its sign checked

For $f\in C([0,1])$, define
$$G(x,y)=\min(x,y)(1-\max(x,y)),\qquad (Gf)(x)=\int_0^1G(x,y)f(y)\,dy.$$
Splitting at $y=x$ gives
$$(Gf)(x)=(1-x)\int_0^x yf(y)\,dy+x\int_x^1(1-y)f(y)\,dy.$$
Differentiate: the moving-endpoint terms cancel in the first derivative; the second derivative is $-f(x)$. Both endpoint values vanish. For $f=1$, this gives $x(1-x)/2$, an immediate sign check.

The continuous symmetric kernel defines a bounded self-adjoint operator on $L^2$. It is compact because uniform approximations of its kernel by rectangular step functions give finite-rank operators converging in operator norm; alternatively use uniform continuity and Arzelà–Ascoli. Fubini is legitimate because the bounded kernel times $|f(y)g(x)|$ is integrable by Cauchy–Schwarz on this finite interval.

The normalised functions $e_n(x)=\sqrt2\sin(n\pi x)$ form an orthonormal basis of $L^2(0,1)$, by odd extension and Fourier completeness. Direct differentiation shows
$$Ge_n=\frac1{(n\pi)^2}e_n.$$
Hence for $f=\sum f_ne_n$, $u=Gf=\sum f_n(n\pi)^{-2}e_n$ in $L^2$. For continuous f the integral formula additionally proves a classical $C^2$ solution; norm convergence alone does not license term-by-term differentiation of an arbitrary series.

## A nonconstant potential

Consider $-u''+Vu=f$, with zero endpoint values, $f\in C([0,1])$, and $V\in C([0,1])$ real and nonnegative. Uniqueness follows by multiplying the difference of two solutions by its conjugate and integrating by parts:
$$0=\int_0^1|u'|^2+V|u|^2.$$
Thus u is constant and the boundary conditions force zero.

For existence define $G^{1/2}e_n=(n\pi)^{-1}e_n$ and $S=G^{1/2}M_VG^{1/2}$, where $M_V$ multiplies by V. S is compact self-adjoint and nonnegative, since $\langle Sw,w\rangle=\int V|G^{1/2}w|^2\ge0$. Its spectral expansion makes $I+S$ invertible with inverse norm at most one. Put
$$w=(I+S)^{-1}G^{1/2}f,\qquad u=G^{1/2}w.$$
Multiplication by $G^{1/2}$ gives $u+GM_Vu=Gf$. The series for $G^{1/2}w$ converges uniformly by Cauchy–Schwarz and $\sum n^{-2}<\infty$, so u is continuous and vanishes at the endpoints. Therefore $u=G(f-Vu)$ is C² and solves the original problem. This passage from a Hilbert-space equation to classical regularity is essential.

Exercises 1–3 of your final sheet ask for a spectral error bound, a resonance analysis, and reconstruction of the variable-potential argument. Use it as a cumulative examination in an uninterrupted session if you wish; a provisional first-attempt estimate for exercises 1–3 is two to three hours. The separate proof portfolio in exercise 4 has its own 210-minute planning estimate. Afterwards compare complete arguments, including the hypotheses, rather than counting matched formulas.

## Assessed proof work

The final assessment has two connected components. Exercise 4 requires a complete proof of the compact self-adjoint spectral theorem from the permitted earlier Hilbert-space facts; the extremal-eigenvector lemma may not be quoted without proof. Exercises 1–3 establish the boundary-value applications. The assigned primary proof remains required reading, while the portfolio makes its reconstruction explicit and assessable.
