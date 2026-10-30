## Why functional analysis

Calculus and linear algebra solve problems with finitely many unknowns: minimise a function on $\mathbb{R}^n$, solve a linear system. Many problems that matter are not like that. "Find the shortest curve between two points" asks for a *function*, and a function $f:[0,1]\to\mathbb{R}$ needs infinitely many real numbers to specify. The notes open with exactly this observation (lecture 1, Example 2): the unknown lives in an infinite-dimensional vector space, and we want to do analysis there.

The plan of the whole course is to find out which finite-dimensional facts survive, which fail, and what replaces the ones that fail. This unit meets the first casualty.

## Vector spaces, finite and infinite dimension

**Definition (vector space).** A vector space $V$ over a field $K$, which for us is always $\mathbb{R}$ or $\mathbb{C}$, is a set with an addition $V\times V\to V$ and a scalar multiplication $K\times V\to V$ satisfying the usual axioms (lecture 1, Definition 3).

$\mathbb{R}^n$ and $\mathbb{C}^n$ are vector spaces; so is $C([0,1])$, the continuous functions $[0,1]\to\mathbb{C}$, because sums and scalar multiples of continuous functions are continuous (Example 4).

**Definition (finite-dimensional).** $V$ is finite-dimensional if every linearly independent subset is finite; otherwise it is infinite-dimensional (Definition 5).

**Example (C([0,1]) is infinite-dimensional).** The set $\{f_n(x)=x^n : n\ge 0\}$ is linearly independent: a polynomial that vanishes on all of $[0,1]$ has all coefficients zero. It is infinite, so $C([0,1])$ is infinite-dimensional (Example 6). Keep this family in mind; it returns in the exercises.

The notes warn immediately that facts such as the Heine–Borel theorem become false in infinite dimensions. The first thing we need, as in any analysis, is a notion of distance.

## Norms and the metric they induce

**Definition (norm).** A norm on $V$ is a function $\|\cdot\|:V\to[0,\infty)$ such that

1. (Definiteness) $\|v\|=0$ if and only if $v=0$;
2. (Homogeneity) $\|\lambda v\| = |\lambda|\,\|v\|$ for all $\lambda\in K$, $v\in V$;
3. (Triangle inequality) $\|v+w\|\le\|v\|+\|w\|$ for all $v,w\in V$.

A vector space with a chosen norm is a *normed space* (Definition 7).

The phrase "a chosen norm" matters. The same vector space carries many norms, and in infinite dimensions the choice changes what converges.

**Proposition (induced metric).** If $\|\cdot\|$ is a norm on $V$ then $d(v,w)=\|v-w\|$ is a metric on $V$ (Proposition 8).

**Proof.** Definiteness of the norm gives $d(v,w)=0\iff v=w$. Symmetry: $\|v-w\| = \|(-1)(w-v)\| = |-1|\,\|w-v\|$ by homogeneity. The triangle inequality for $d$ follows from the one for the norm applied to $(x-y)+(y-z)=x-z$. $\square$

So every normed space is a metric space, and all the metric vocabulary applies: open balls $B(x,r)$, convergence, Cauchy sequences, completeness.

**Example (norms on $K^n$).** The Euclidean norm $\|x\|_2=\big(\sum|x_i|^2\big)^{1/2}$, the sup norm $\|x\|_\infty=\max_i|x_i|$, and for $1\le p<\infty$ the $p$-norms $\|x\|_p=\big(\sum|x_i|^p\big)^{1/p}$ are all norms on $\mathbb{R}^n$ and $\mathbb{C}^n$ (Example 9). Their unit balls look different (a disc, a square, intermediate shapes in $\mathbb{R}^2$), yet in finite dimensions they all define the same convergent sequences. Hold that thought.

## The sup norm on bounded continuous functions

**Definition ($C_\infty(X)$).** For a metric space $X$, $C_\infty(X)=\{f:X\to\mathbb{C} : f \text{ continuous and bounded}\}$ (Definition 10). When $X=[0,1]$ every continuous function is bounded, so $C_\infty([0,1])=C([0,1])$.

**Proposition (sup norm).** $\|u\|_\infty=\sup_{x\in X}|u(x)|$ is a norm on $C_\infty(X)$ (Proposition 11).

**Proof.** Definiteness and homogeneity are immediate from the definition of the supremum. For the triangle inequality, for each $x$,
$$|u(x)+v(x)|\le|u(x)|+|v(x)|\le\|u\|_\infty+\|v\|_\infty,$$
and taking the supremum over $x$ on the left gives $\|u+v\|_\infty\le\|u\|_\infty+\|v\|_\infty$. $\square$

Unpacking convergence in this norm: $u_n\to u$ in $C_\infty(X)$ means $\lim_n\|u_n-u\|_\infty=0$, that is,
$$\forall\varepsilon>0\ \exists N\ \forall n\ge N\ \forall x\in X:\ |u_n(x)-u(x)|<\varepsilon,$$
which is exactly *uniform* convergence on $X$. The norm you choose is the mode of convergence you get.

**Definition ($\ell^p$).** For $1\le p<\infty$, $\ell^p$ is the space of sequences $a=(a_j)_{j\ge1}$ with $\|a\|_p=\big(\sum_j|a_j|^p\big)^{1/p}<\infty$ (Definition 12). The sequence $(1/j)$ lies in $\ell^p$ for every $p>1$ but not in $\ell^1$ (Example 13). That the triangle inequality holds for $\|\cdot\|_p$ is not obvious; it is Minkowski's inequality, and the notes leave it as an exercise for the problem sets.

## Banach spaces

**Definition (Banach space).** A normed space is a Banach space if it is complete with respect to the metric induced by its norm: every Cauchy sequence converges to a point of the space (Definition 14).

$\mathbb{Q}$ is not complete; $\mathbb{R}$ fills the holes. We want our spaces of functions to have no holes, because the methods of analysis produce limits of approximations and we need those limits to exist *inside* the space we are working in.

**Example.** $\mathbb{R}^n$ and $\mathbb{C}^n$ are complete in every $\|\cdot\|_p$ (Example 15).

**Theorem.** For any metric space $X$, $C_\infty(X)$ with the sup norm is a Banach space (Theorem 16).

**Proof.** The proof is the template for every completeness proof in this course, so learn its three steps. Let $(u_n)$ be Cauchy in $\|\cdot\|_\infty$.

*Step 1 (candidate limit).* For each fixed $x$, $|u_n(x)-u_m(x)|\le\|u_n-u_m\|_\infty$, so $(u_n(x))$ is Cauchy in $\mathbb{C}$ and converges; define $u(x)=\lim_n u_n(x)$.

*Step 2 (the candidate is in the space).* Cauchy sequences are bounded, say $\|u_n\|_\infty\le M$, so $|u(x)|=\lim|u_n(x)|\le M$: $u$ is bounded. Continuity of $u$ follows from the uniform estimate in step 3 and the standard fact that a uniform limit of continuous functions is continuous.

*Step 3 (convergence in norm).* Given $\varepsilon>0$ choose $N$ with $\|u_n-u_m\|_\infty<\varepsilon$ for $n,m\ge N$. Fix $x$ and $n\ge N$ and let $m\to\infty$: $|u_n(x)-u(x)|\le\varepsilon$. This holds for every $x$, so $\|u_n-u\|_\infty\le\varepsilon$ for $n\ge N$. $\square$

Notice where completeness of $\mathbb{C}$ was used (step 1) and where the *sup* norm specifically was used (steps 1 and 3: the norm controls every point at once). A norm that does not control every point will not give us this argument, which is the point of the exercises.

## The first casualty: norm equivalence

**Definition (equivalent norms).** Two norms $\|\cdot\|_a$ and $\|\cdot\|_b$ on $V$ are equivalent if there are constants $c,C>0$ with $c\|v\|_b\le\|v\|_a\le C\|v\|_b$ for all $v\in V$. Equivalent norms have the same convergent sequences, the same Cauchy sequences and the same open sets.

In finite dimensions, *all* norms are equivalent. The proof uses compactness of the unit sphere, which is where finite dimensionality enters. On $C([0,1])$ consider the sup norm and the integral norm $\|f\|_1=\int_0^1|f(x)|\,dx$. Is there a constant $C$ with $\|f\|_\infty\le C\|f\|_1$ for every continuous $f$? Exercise 1 asks you to test this on the family $f_n(x)=x^n$ from Example 6; exercise 2 asks whether $(C([0,1]),\|\cdot\|_1)$ is complete at all. Do not read ahead to the answers: the tutorial is built around your attempt.

**Warning.** When a theorem in this course has "Banach" or "complete" among its hypotheses, that hypothesis is doing work. The habit to form now is to ask, for each theorem, what breaks without it. The exercises in this unit are the first instance.

## What to carry forward

A norm is a choice; it fixes a mode of convergence. $C_\infty(X)$ with the sup norm is complete, by a three-step argument you will reuse many times. In infinite dimensions, different norms can be inequivalent, and a normed space of functions can fail to be complete. Next unit: series in Banach spaces, bounded linear operators, and the first theorem that says "bounded" and "continuous" are the same thing for linear maps.
