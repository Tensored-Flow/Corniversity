## Subspaces of Banach spaces

**Definition (subspace).** A subset $W\subseteq V$ of a vector space is a subspace if it is closed under linear combinations: $\lambda_1w_1+\lambda_2w_2\in W$ for all $w_1,w_2\in W$ and scalars $\lambda_1,\lambda_2$ (lecture 3, Definition 29).

In a normed space a subspace inherits the norm. Whether it inherits completeness is a genuine question.

**Proposition.** Let $V$ be a Banach space and $W\subseteq V$ a subspace. Then $W$ (with the inherited norm) is a Banach space if and only if $W$ is a closed subset of $V$ (Proposition 30).

**Proof.** Suppose $W$ is closed and $(w_n)$ is Cauchy in $W$. It is Cauchy in $V$, so converges to some $v\in V$; closedness gives $v\in W$. Conversely suppose $W$ is complete and $w_n\to v$ in $V$ with $w_n\in W$. A convergent sequence is Cauchy, so $(w_n)$ converges in $W$ to some $w$; limits in $V$ are unique, so $v=w\in W$. $\square$

**Non-example.** The polynomial functions form a subspace of $C([0,1])$. By the Weierstrass approximation theorem every continuous function is a uniform limit of polynomials, so the polynomials are *dense* in $C([0,1])$ and not closed (they are a proper subspace). By the proposition they are not complete in the sup norm, even though $C([0,1])$ is. Exercise 1 asks you to make this precise.

## Quotient spaces

**Definition (quotient).** For a subspace $W\subseteq V$, define $v\sim v'$ when $v-v'\in W$; the quotient space $V/W$ is the set of equivalence classes $[v]=v+W$ with the obvious linear structure (Definition 31).

When $V$ is normed and $W$ is *closed*, the quotient carries the norm $\|[v]\|_{V/W}=\inf_{w\in W}\|v-w\|$, the distance from $v$ to $W$. Closedness is what makes this definite: if $\|[v]\|=0$ then $v$ is a limit of elements of $W$, so $v\in W$ and $[v]=0$. Without closedness one only gets a *seminorm*.

**Definition (seminorm).** A seminorm satisfies homogeneity and the triangle inequality but may vanish on nonzero vectors. The notes' Example 32: $f\mapsto\sup|f'|$ on differentiable functions is a seminorm, vanishing on constants.

**Theorem.** If $\|\cdot\|$ is a seminorm on $V$ and $E=\{v:\|v\|=0\}$, then $E$ is a subspace, and $\|v+E\|_{V/E}=\|v\|$ is a well-defined norm on $V/E$ (Theorem 33).

This is how one passes from "almost a norm" to a norm: quotient out exactly what the seminorm cannot see. The same move produces $L^p$ later in the course, where functions equal almost everywhere are identified.

## The Baire category theorem

We now reach the engine behind three of the course's big theorems.

**Theorem (Baire).** Let $M$ be a complete metric space and $(C_n)_{n\in\mathbb{N}}$ closed subsets with $M=\bigcup_nC_n$. Then at least one $C_n$ contains an open ball $B(x,r)$ (Theorem 34).

Read it carefully. It does *not* say a complete space is not a countable union of closed sets ($\mathbb{R}=\bigcup_n[-n,n]$). It says the closed pieces cannot all be *thin*: a closed set with empty interior is called *nowhere dense*, and the theorem says a complete metric space is not a countable union of nowhere dense sets.

**Proof (sketch; the notes give the details).** Suppose every $C_n$ has empty interior. Pick a ball $B_1=B(x_1,r_1)$ missing $C_1$ (possible since $C_1$ has empty interior and its complement is open). Inside $B_1$ pick a smaller closed ball $\overline{B(x_2,r_2)}$ missing $C_2$, with $r_2<r_1/2$; continue. The centres form a Cauchy sequence (the radii halve), so converge to some $x$ by completeness; $x$ lies in every closed ball, hence in no $C_n$, contradicting $M=\bigcup C_n$. $\square$

Completeness is used exactly once, to produce $x$. Without it the theorem fails: $\mathbb{Q}$ is a countable union of singletons, each closed and nowhere dense.

The notes remark that Baire's theorem yields the existence of a continuous nowhere-differentiable function. Exercise 2 gives you a different first application: an infinite-dimensional Banach space cannot have a countable Hamel basis.

## The uniform boundedness principle

**Theorem (uniform boundedness).** Let $B$ be a Banach space, $V$ a normed space, and $(T_n)$ a sequence in $B(B,V)$. If $\sup_n\|T_nb\|<\infty$ for every $b\in B$, then $\sup_n\|T_n\|<\infty$ (Theorem 36).

Pointwise bounded implies uniformly bounded, on a *complete* domain.

**Proof.** Let $C_k=\{b\in B:\|T_nb\|\le k\text{ for all }n\}$. Each $C_k$ is closed (an intersection of preimages of closed balls under continuous maps), and by pointwise boundedness every $b$ lies in some $C_k$, so $B=\bigcup_kC_k$. By Baire, some $C_k$ contains a ball $B(b_0,r)$. For $\|b\|<r$ we have $b_0+b\in B(b_0,r)$, hence
$$\|T_nb\|\le\|T_n(b_0+b)\|+\|T_nb_0\|\le 2k\quad\text{for all }n,$$
and by homogeneity $\|T_n\|\le 2k/r$ for all $n$. $\square$

The hypothesis that $B$ is complete enters only through Baire's theorem, and it cannot be dropped: exercise 3 asks you to find operators on the incomplete space of finitely supported sequences that are pointwise bounded but not uniformly bounded.

## What to carry forward

Completeness passes to closed subspaces and to quotients by closed subspaces, and to nothing else automatically. Baire's theorem turns completeness into a tool: a complete space is "large" in the sense that it cannot be exhausted by countably many nowhere dense closed sets. The uniform boundedness principle is the first of three consequences; the open mapping and closed graph theorems follow in the next unit.
