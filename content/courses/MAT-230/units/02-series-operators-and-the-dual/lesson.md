## Series in a normed space

A sequence $(v_n)$ in a normed space $V$ gives a series $\sum_n v_n$. The series is *summable* if the partial sums $\sum_{n=1}^m v_n$ converge in $V$ as $m\to\infty$, and *absolutely summable* if $\sum_n\|v_n\|<\infty$ (lecture 2, Definition 17). In $\mathbb{R}$ absolute convergence implies convergence; the reason is completeness, and that is exactly the content of the next theorem.

**Proposition.** If $\sum_n v_n$ is absolutely summable, its partial sums form a Cauchy sequence (Proposition 18).

**Proof.** For $m>k$, $\big\|\sum_{n=k+1}^m v_n\big\|\le\sum_{n=k+1}^m\|v_n\|$ by the triangle inequality, and the right side tends to $0$ as $k\to\infty$ because the tail of a convergent series of nonnegative numbers tends to $0$. $\square$

**Theorem.** A normed space $V$ is a Banach space if and only if every absolutely summable series in $V$ is summable (Theorem 19).

**Proof.** ($\Rightarrow$) By the proposition the partial sums are Cauchy; completeness makes them converge.

($\Leftarrow$) Let $(u_n)$ be Cauchy. Choose indices $n_1<n_2<\cdots$ with $\|u_n-u_m\|<2^{-k}$ for $n,m\ge n_k$. Put $v_1=u_{n_1}$ and $v_k=u_{n_k}-u_{n_{k-1}}$ for $k\ge2$. Then $\sum_k\|v_k\|\le\|u_{n_1}\|+\sum_k 2^{-(k-1)}<\infty$, so by hypothesis $\sum_k v_k$ converges; its partial sums are exactly $u_{n_k}$, so the subsequence $(u_{n_k})$ converges to some $u$. A Cauchy sequence with a convergent subsequence converges to the same limit. $\square$

Why bother with this reformulation? Because in many spaces it is easier to show "absolutely summable implies summable" than to handle an arbitrary Cauchy sequence. The notes use it immediately for operator spaces (Theorem 27) and later for $L^p$.

## Linear operators and boundedness

**Example (an integral operator).** Let $K:[0,1]^2\to\mathbb{C}$ be continuous. For $f\in C([0,1])$ define $(Tf)(x)=\int_0^1K(x,y)f(y)\,dy$ (Example 20). This is the kind of operator functional analysis was built to study.

**Definition (linear operator).** A map $T:V\to W$ between vector spaces is linear if $T(\lambda_1v_1+\lambda_2v_2)=\lambda_1Tv_1+\lambda_2Tv_2$ (Definition 21).

**Theorem (continuous iff bounded).** Let $V,W$ be normed spaces and $T:V\to W$ linear. Then $T$ is continuous if and only if there is $C>0$ with $\|Tv\|_W\le C\|v\|_V$ for all $v\in V$ (Theorem 22). Such a $T$ is called *bounded*.

**Proof.** ($\Leftarrow$) $\|Tv-Tw\|=\|T(v-w)\|\le C\|v-w\|$, so $T$ is Lipschitz, hence continuous.

($\Rightarrow$) Continuity at $0$ with $\varepsilon=1$ gives $\delta>0$ such that $\|v\|\le\delta$ implies $\|Tv\|\le1$. For $v\ne0$ apply this to $\delta v/\|v\|$: $\|T(\delta v/\|v\|)\|\le1$, so by linearity $\|Tv\|\le\|v\|/\delta$. Take $C=1/\delta$. $\square$

Notice how little continuity was needed: continuity at a single point. Linearity spreads it everywhere. This is also the first place the course departs from finite dimensions, where every linear map is bounded. In infinite dimensions "bounded" is a real condition (see the misconceptions for this unit, and exercise 2).

**Example.** The integral operator above is bounded: $|(Tf)(x)|\le\int_0^1|K(x,y)|\,|f(y)|\,dy\le\big(\sup_{[0,1]^2}|K|\big)\|f\|_\infty$, so $\|Tf\|_\infty\le\|K\|_\infty\|f\|_\infty$ (Example 23). Continuity of $Tf$ in $x$ follows from uniform continuity of $K$ on the compact square.

## The space of bounded operators and the operator norm

**Definition.** $B(V,W)$ is the set of bounded linear operators $V\to W$; it is a vector space under pointwise operations (Definition 24). The *operator norm* of $T\in B(V,W)$ is
$$\|T\|=\sup_{\|v\|=1}\|Tv\|\quad(\text{Definition 25}).$$

Equivalent descriptions you should be able to prove (exercise 1): $\|T\|=\sup_{v\ne0}\|Tv\|/\|v\|$, and $\|T\|$ is the least constant $C$ for which $\|Tv\|\le C\|v\|$ holds for all $v$. In particular $\|Tv\|\le\|T\|\,\|v\|$ always.

**Theorem.** The operator norm is a norm, so $B(V,W)$ is a normed space (Theorem 26).

**Proof.** Definiteness: if $\|T\|=0$ then $Tv=0$ for every unit vector, hence for every $v$ by linearity, so $T=0$. Homogeneity is immediate from homogeneity of $\|\cdot\|_W$. Triangle inequality: for $\|v\|=1$, $\|(S+T)v\|\le\|Sv\|+\|Tv\|\le\|S\|+\|T\|$; take the supremum over $v$. $\square$

**Theorem.** If $V$ is a normed space and $W$ is a Banach space, then $B(V,W)$ is a Banach space (Theorem 27).

**Proof (sketch; the notes give it in full).** Use Theorem 19. Let $\sum_n T_n$ be absolutely summable in $B(V,W)$. For each $v$, $\sum_n\|T_nv\|\le\sum_n\|T_n\|\,\|v\|<\infty$, so $\sum_nT_nv$ converges in the Banach space $W$; define $Tv$ as its sum. $T$ is linear (limits of linear things), bounded with $\|T\|\le\sum_n\|T_n\|$, and $\big\|T-\sum_{n\le m}T_n\big\|\le\sum_{n>m}\|T_n\|\to0$. $\square$

Where was completeness of $W$ used? Exactly once, to define $Tv$. Where was completeness of $V$ used? Nowhere. That asymmetry is worth remembering.

## The dual space

**Definition.** For a normed space $V$ over $K$, the dual space is $V'=B(V,K)$, the bounded linear functionals on $V$ (Definition 28). Since $K=\mathbb{R}$ or $\mathbb{C}$ is complete, Theorem 27 shows $V'$ is always a Banach space, whether or not $V$ is.

The question "are there enough bounded functionals to separate points of $V$?" is not obvious in infinite dimensions. It is answered in unit 5 by the Hahn–Banach theorem.

## What to carry forward

Completeness can be tested with absolutely summable series. Linear operators are continuous exactly when they are bounded, and in infinite dimensions boundedness is a genuine restriction. $B(V,W)$ carries the operator norm and is complete whenever the target is; so the dual of any normed space is a Banach space. Next unit: subspaces and quotients, and the Baire category theorem, from which the uniform boundedness principle follows.
