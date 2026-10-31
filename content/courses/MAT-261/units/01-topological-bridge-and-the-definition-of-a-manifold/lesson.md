## Why topology comes first

A smooth manifold is a topological space with extra structure: a way of identifying it locally with $\mathbb{R}^n$ so that the identifications agree, up to smooth change of coordinates, where they overlap. The notes open with the standing hypothesis "let $X$ be a Hausdorff, second countable, topological space" (lecture 1, page 1) and never discuss it again. This unit does discuss it, because the two adjectives are genuine hypotheses: in unit 2 we meet spaces with perfectly good atlases that fail one of them. The bridge below collects exactly the point-set topology the definition needs. If you know general topology, read it as a checklist; if you know only metric spaces, it is the whole of what you must add.

## The bridge: what we need from point-set topology

A *topology* on a set $X$ is a family of subsets (the open sets) closed under arbitrary unions and finite intersections and containing $\varnothing$ and $X$. A *basis* is a family $\mathcal{B}$ of open sets such that every open set is a union of members of $\mathcal{B}$. Maps are *continuous* when preimages of open sets are open; a *homeomorphism* is a continuous bijection with continuous inverse.

**Definition (Hausdorff; second countable).** $X$ is *Hausdorff* if distinct points have disjoint open neighbourhoods. $X$ is *second countable* if it has a countable basis.

**Definition (subspace, product, quotient topologies).** A subset $A\subseteq X$ carries the *subspace topology* $\{U\cap A: U \text{ open in } X\}$. A product $X\times Y$ carries the topology with basis $\{U\times V\}$. If $\sim$ is an equivalence relation on $X$ with projection $\pi:X\to X/{\sim}$, the *quotient topology* declares $W\subseteq X/{\sim}$ open exactly when $\pi^{-1}(W)$ is open in $X$; then $\pi$ is continuous, and a map $f:X/{\sim}\to Y$ is continuous if and only if $f\circ\pi$ is.

The facts we use are these.

**Proposition (bridge facts).**
1. $\mathbb{R}^n$ is Hausdorff and second countable (balls with rational centres and radii form a countable basis).
2. Subspaces and finite products of Hausdorff spaces are Hausdorff; subspaces and finite products of second countable spaces are second countable. In particular every subset of $\mathbb{R}^n$ has both properties.
3. If $\pi:X\to X/{\sim}$ is an *open* map (images of open sets are open) and $X$ is second countable, then $X/{\sim}$ is second countable.
4. Hausdorffness does **not** pass to quotients in general. $X/{\sim}$ is Hausdorff if and only if any two distinct classes have disjoint open neighbourhoods whose preimages are disjoint saturated open sets in $X$.
5. A closed and bounded subset of $\mathbb{R}^n$ is compact (Heine–Borel); the continuous image of a compact space is compact; a compact subset of a Hausdorff space is closed.

**Proof.** (1) and (5) are standard analysis. (2): for a subspace $A$, intersect the separating neighbourhoods, or the countable basis, with $A$; for products, use products of neighbourhoods and products of basic sets. (3): let $\mathcal{B}$ be a countable basis of $X$. Given $W$ open in $X/{\sim}$ and $y=\pi(x)\in W$, the set $\pi^{-1}(W)$ is open and contains $x$, so some $B\in\mathcal{B}$ has $x\in B\subseteq\pi^{-1}(W)$, whence $y\in\pi(B)\subseteq W$; each $\pi(B)$ is open because $\pi$ is open, so $\{\pi(B):B\in\mathcal{B}\}$ is a countable basis. (4) is a restatement of the definitions, recorded because it is the step people forget. $\square$

Finally, $X$ is *locally Euclidean of dimension $n$* if every point has an open neighbourhood homeomorphic to an open subset of $\mathbb{R}^n$. Manifolds are locally Euclidean, Hausdorff, second countable spaces with a smooth structure; here is the precise version.

## Charts, atlases and smooth structures

**Definition (chart).** A *chart* on $X$ is a pair $(U,\varphi)$ with $U\subseteq X$ open and $\varphi:U\to\varphi(U)\subseteq\mathbb{R}^n$ a homeomorphism onto an open subset of $\mathbb{R}^n$. The components $\varphi=(x^1,\dots,x^n)$ are the *coordinates* of the chart (lecture 1, Definition 1.1).

Given two charts $(U_1,\varphi_1)$ and $(U_2,\varphi_2)$ we get the *transition maps*
$$\varphi_2\circ\varphi_1^{-1}:\varphi_1(U_1\cap U_2)\to\varphi_2(U_1\cap U_2),\qquad \varphi_1\circ\varphi_2^{-1}:\varphi_2(U_1\cap U_2)\to\varphi_1(U_1\cap U_2),$$
homeomorphisms between open subsets of $\mathbb{R}^n$, inverse to each other.

**Definition (compatible charts; atlas).** Two charts are *compatible* if both transition maps are smooth, meaning $C^\infty$ (Definition 1.2). An *atlas* is a collection of pairwise compatible charts whose domains cover $X$. Two atlases are *equivalent* if their union is an atlas, and an atlas is *maximal* if it contains every chart compatible with all of its charts (lecture 1, page 2).

Every atlas is contained in a unique maximal atlas. The notes ask you to prove this with Zorn's lemma (Exercise 1); exercise 3 of this unit shows that Zorn is not needed, because smoothness of a transition map can be tested one chart of the given atlas at a time.

**Definition (smooth manifold).** A *smooth $n$-dimensional manifold* is a Hausdorff, second countable topological space $X$ together with an atlas $\mathcal{A}$ of charts into $\mathbb{R}^n$ (Definition 1.3). The maximal atlas containing $\mathcal{A}$ is the *smooth structure*; equivalent atlases define the same manifold.

Requiring the overlap maps to be merely homeomorphisms gives a *topological manifold*; requiring $C^k$ overlaps gives a $C^k$ manifold; requiring holomorphic overlaps for charts into $\mathbb{C}^n$ gives a *complex manifold* (Definition 1.4). Hitchin's notes (§2.1–2.2) arrive at the same objects from the other end: they start with a *set* $X$ and an atlas of bijections, use the charts to define the topology of $X$, and then impose the Hausdorff and second countability conditions. Keep both pictures: Mrowka's presupposes the topology, Hitchin's manufactures it from the charts.

## Examples

**Example ($\mathbb{R}^n$).** $\mathbb{R}^n$, or any open subset of it, is a smooth manifold with an atlas consisting of the single chart $(\mathbb{R}^n,\mathrm{id})$ (§1.1).

**Example (the sphere).** $S^n=\{x\in\mathbb{R}^{n+1}:\sum_{i=0}^n (x^i)^2=1\}$ has an atlas of two charts $(U_\pm,\varphi_\pm)$ with $U_\pm=S^n\setminus\{(\pm1,0,\dots,0)\}$ and
$$\varphi_\pm(x^0,x^1,\dots,x^n)=\frac{1}{1\mp x^0}\,(x^1,\dots,x^n),$$
the stereographic projections from the two poles on the $x^0$-axis (§1.1). The topology is the subspace topology from $\mathbb{R}^{n+1}$, so bridge fact 2 gives Hausdorff and second countable at once, and Heine–Borel gives compactness. Exercise 1 asks you to compute the transition map and check compatibility; it is a formula you will see again in unit 4 and in Riemannian geometry.

**Example (real projective space).** $\mathbb{RP}^n$ is the set of lines through the origin in $\mathbb{R}^{n+1}$, that is the quotient $(\mathbb{R}^{n+1}\setminus\{0\})/\mathbb{R}^*$ with the quotient topology, the class of $(x^0,\dots,x^n)$ written $[x^0:\dots:x^n]$. The $n+1$ sets $U_i=\{[x]:x^i\neq0\}$ with
$$\varphi_i([x^0:\dots:x^n])=\Big(\frac{x^0}{x^i},\dots,\widehat{\frac{x^i}{x^i}},\dots,\frac{x^n}{x^i}\Big)\in\mathbb{R}^n$$
(the hat marks the omitted entry) form an atlas (§1.1). Here the topology is *not* inherited from a Euclidean space, so the bridge is needed in earnest: the projection is an open map, which gives second countability by fact 3, but Hausdorffness has to be proved by hand (fact 4). Exercise 2 does both and computes the transition maps, which are rational.

**Example (complex projective space and Grassmannians).** Replacing $\mathbb{R}$ by $\mathbb{C}$ gives $\mathbb{CP}^n=(\mathbb{C}^{n+1}\setminus\{0\})/\mathbb{C}^*$ with $n+1$ charts into $\mathbb{C}^n$ whose overlaps are holomorphic, so $\mathbb{CP}^n$ is a complex manifold of complex dimension $n$ and a smooth manifold of real dimension $2n$ (Definition 1.4). The Grassmannian $\mathrm{Gr}_k(\mathbb{R}^n)$ of $k$-planes through the origin has an atlas of $\binom{n}{k}$ charts, each identifying the planes transverse to a fixed coordinate $(n-k)$-plane $\Lambda^\perp$ with $\mathrm{Hom}(\Lambda,\Lambda^\perp)\cong\mathbb{R}^{k(n-k)}$ via graphs (Exercise 3 of the notes); the same charts return in unit 4 when we build the tautological bundle.

## Why the dimension is well defined

If $(U,\varphi)$ and $(V,\psi)$ are compatible charts into $\mathbb{R}^n$ and $\mathbb{R}^m$ with $U\cap V\neq\varnothing$, the transition map is a diffeomorphism between open subsets of $\mathbb{R}^n$ and $\mathbb{R}^m$; its derivative at any point is an invertible linear map $\mathbb{R}^n\to\mathbb{R}^m$, so $n=m$. (Without smoothness this needs Brouwer's invariance of domain; with smoothness it is linear algebra.) So on a connected manifold all charts have the same $n$, the *dimension*.

**Warning.** The existence of an atlas does not imply either topological axiom. The line with two origins has an atlas of two charts and is not Hausdorff; the long line is locally Euclidean and Hausdorff but not second countable (lecture 2, §3). Both are dissected in unit 2. So when you verify that something is a manifold you have three separate things to check: the topology (Hausdorff, second countable), the charts (homeomorphisms onto open sets, covering $X$), and the overlaps (smooth). Exercises 1 and 2 are built around keeping these apart.

## What to carry forward

A manifold is a Hausdorff, second countable space with an atlas whose transition maps are smooth, considered up to equivalence of atlases. Topological axioms are checked through subspaces, products and, with care, quotients; charts are checked by exhibiting inverses; compatibility is checked by computing transition maps. Next unit: smooth maps between manifolds, the pathologies that justify the axioms, and the derivative of a map between vector spaces.
