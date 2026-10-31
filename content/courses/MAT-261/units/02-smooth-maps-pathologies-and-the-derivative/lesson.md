## Smooth maps between manifolds

Having defined the objects, we define the maps. The idea is the only one available: read everything in charts.

**Definition (smooth map).** Let $X$ and $Y$ be smooth manifolds. A continuous map $f:X\to Y$ is *smooth* if for every chart $(U,\varphi)$ of $X$ and every chart $(V,\psi)$ of $Y$ the composition
$$\psi\circ f\circ\varphi^{-1}:\varphi\big(U\cap f^{-1}(V)\big)\to\psi(V)$$
is smooth (lecture 2, §2). The domain is open because $f$ is continuous. A *diffeomorphism* is a homeomorphism $h:X\to Y$ such that $h$ and $h^{-1}$ are smooth; $X$ and $Y$ are then *diffeomorphic*.

**Proposition (one atlas suffices).** If $\psi\circ f\circ\varphi^{-1}$ is smooth for all charts of one atlas of $X$ and one atlas of $Y$, then $f$ is smooth.

**Proof.** Let $(U',\varphi')$, $(V',\psi')$ be arbitrary charts of the smooth structures, and $x\in U'\cap f^{-1}(V')$. Pick atlas charts $(U,\varphi)\ni x$ and $(V,\psi)\ni f(x)$. On the open set $\varphi'(U\cap U'\cap f^{-1}(V\cap V'))$,
$$\psi'\circ f\circ\varphi'^{-1}=(\psi'\circ\psi^{-1})\circ(\psi\circ f\circ\varphi^{-1})\circ(\varphi\circ\varphi'^{-1}),$$
a composition of smooth maps (two transition maps and one chart expression of $f$). Smoothness is local, so $\psi'\circ f\circ\varphi'^{-1}$ is smooth. $\square$

This is the same locality argument as exercise 3 of unit 1; it will be used silently from now on.

**Example.** The inclusion $S^n\hookrightarrow\mathbb{R}^{n+1}$ is smooth: in the stereographic chart it is $y\mapsto\big(\tfrac{|y|^2-1}{|y|^2+1},\tfrac{2y}{|y|^2+1}\big)$. The projection $\pi:\mathbb{R}^{n+1}\setminus\{0\}\to\mathbb{RP}^n$ is smooth: in the affine chart $\varphi_i$ it reads $x\mapsto(x^0/x^i,\dots,x^n/x^i)$ on $\{x^i\neq0\}$. A *smooth function* is a smooth map to $\mathbb{R}$; a *smooth curve* is a smooth map from an interval.

## The standard pathologies

The notes make a point that is easy to miss: "the condition that $X$ be Hausdorff and second countable does not follow from the existence of an atlas" (lecture 2, §3). Two examples show that each axiom is independent of the chart structure.

**Example (the line with two origins).** Let $X$ be the quotient of $\mathbb{R}\times\{0,1\}$ by the relation $(t,0)\sim(t,1)$ for $t\neq0$. The two copies of the line are glued everywhere except at the origin, so $X$ looks like $\mathbb{R}$ with the point $0$ doubled. Writing $U_i$ for the image of $\mathbb{R}\times\{i\}$, the inverses of the two inclusions give charts $\varphi_i:U_i\to\mathbb{R}$ whose transition map is the identity on $\mathbb{R}\setminus\{0\}$. So $X$ has a smooth atlas with two charts and is second countable, but it is not Hausdorff: every neighbourhood of one origin meets every neighbourhood of the other. Exercise 1 proves this and draws the consequences (non-unique limits, compact sets that are not closed). The notes remark that such spaces arise in real life, in the theory of foliations and in quotients by non-compact group actions (Remark 1).

**Example (the long line).** Let $S_\Omega$ be the smallest uncountable well-ordered set and give $X=S_\Omega\times(0,1]$ the dictionary-order topology. Around a point $(\omega,t)$ with $t\neq1$ the set $\{\omega\}\times(0,1)$ with coordinate $t$ is a chart; around $(\omega,1)$ one glues the end of the segment at $\omega$ to the beginning of the segment at the successor $S(\omega)$ (the notes write out this chart). The overlaps are translations, so $X$ is a smooth atlas-carrying Hausdorff space. But the sets $\{\omega\}\times(0,1)$, $\omega\in S_\Omega$, form an uncountable family of pairwise disjoint open sets, and a basis must contain a member inside each of them; so no basis is countable and $X$ is not second countable (lecture 2, page 2).

**Warning.** Verifying "manifold" therefore means three verifications, and the atlas only delivers the third. In unit 1 we used subspaces for $S^n$ and saturated open sets for $\mathbb{RP}^n$; exercise 1 shows what goes wrong when the saturated sets cannot be separated.

## Different charts, same manifold

Consider $\mathbb{R}_1=(\mathbb{R},x)$ with its standard chart and $\mathbb{R}_2=(\mathbb{R},x^3)$ with the single chart $\varphi(x)=x^3$ (lecture 2, page 2). Both are smooth manifolds. The two charts are not compatible, since $\mathrm{id}\circ\varphi^{-1}(y)=y^{1/3}$ is not differentiable at $0$; so they define *different* smooth structures on the same topological space. Nevertheless the manifolds are diffeomorphic: exercise 2 asks you to show that the identity is smooth in one direction only, and to find the map that is a diffeomorphism $\mathbb{R}_1\to\mathbb{R}_2$. The moral is that "the set of charts" is a finer invariant than "the manifold up to diffeomorphism", and only the latter is geometrically meaningful.

The deep version of this question is: given a topological manifold, how many smooth structures does it carry, up to diffeomorphism? The notes record Milnor's discovery that $S^7$ admits a smooth structure, given by an atlas with two charts, that is not diffeomorphic to the standard one. We will not prove this, but keep it in view as a reason for taking the definitions seriously.

## The derivative of a map between vector spaces

To go further we need calculus. Let $V,W$ be normed real vector spaces (for us finite-dimensional, but the notes state everything for Banach spaces because the proofs are identical and the generality is used later for Smale's Sard theorem).

**Definition (differential).** Let $U\subseteq V$ be open and $f:U\to W$. Then $f$ is *differentiable at $x\in U$* if there is a continuous linear map $L_x:V\to W$ with
$$\|f(x')-f(x)-L_x(x'-x)\|=o(\|x'-x\|)\qquad(x'\to x)$$
(lecture 3, Definition 4.1). Here $o(\cdot)$ denotes a function $o:[0,\infty)\to[0,\infty)$, continuous at $0$ with $o(0)=0$, as in the notes.

**Proposition.** The map $L_x$ is unique; it is called the *differential* of $f$ at $x$ and written $d_xf$ or $D_xf$.

**Proof.** If $L$ and $L'$ both work, then $\|(L-L')(x'-x)\|\le\|f(x')-f(x)-L(x'-x)\|+\|f(x')-f(x)-L'(x'-x)\|=o(\|x'-x\|)$. Put $x'=x+tv$ for a fixed $v$ and $t\to0$: $|t|\,\|(L-L')v\|=o(|t|)$, forcing $(L-L')v=0$. $\square$

$f$ is *differentiable* if it is differentiable at every point and *continuously differentiable* ($C^1$) if $df:U\to\mathrm{Hom}(V,W)$ is continuous; $d^2f:U\to\mathrm{Hom}(V,\mathrm{Hom}(V,W))$ is the derivative of $df$, identified with bilinear maps, and so on; $f$ is *smooth* if it is $C^k$ for every $k$. For $V=\mathbb{R}^n$, $W=\mathbb{R}^m$ the matrix of $d_xf$ in the standard bases is the Jacobian $(\partial f^i/\partial x^j)$, and the chain rule $d_x(g\circ f)=d_{f(x)}g\circ d_xf$ holds.

## Rank, immersions and submersions

For a smooth map $f:X\to Y$ between manifolds and $x\in X$, choose charts $(U,\varphi)$ about $x$ and $(V,\psi)$ about $f(x)$ and define the *rank of $f$ at $x$* as the rank of the linear map $d_{\varphi(x)}(\psi\circ f\circ\varphi^{-1})$.

**Lemma.** The rank is independent of the charts.

**Proof.** Changing charts replaces $\psi\circ f\circ\varphi^{-1}$ by $(\psi'\circ\psi^{-1})\circ(\psi\circ f\circ\varphi^{-1})\circ(\varphi\circ\varphi'^{-1})$; by the chain rule its differential is the old differential composed on both sides with invertible linear maps (differentials of diffeomorphisms), which does not change the rank. $\square$

**Definition (immersion, submersion).** A smooth map $f:X\to Y$ is an *immersion* if its differential is everywhere injective (rank $=\dim X$) and a *submersion* if its differential is everywhere surjective (rank $=\dim Y$) (lecture 3, Definition 4.2).

**Example.** For $m<n$, the inclusion $i(x^1,\dots,x^m)=(x^1,\dots,x^m,0,\dots,0)$ is an immersion $\mathbb{R}^m\to\mathbb{R}^n$ and the projection $s(x^1,\dots,x^n)=(x^1,\dots,x^m)$ is a submersion $\mathbb{R}^n\to\mathbb{R}^m$. The notes promise that "locally these simple examples are completely general": that is the content of the inverse function theorem and its corollaries, the subject of unit 3.

**Example (two warnings in one).** The curve $\gamma(t)=(t^2,t^3)$ is smooth but not an immersion at $t=0$, and its image has a cusp. The curve $\beta(t)=(\sin 2t,\sin t)$ on $(-\pi,\pi)$ is an injective immersion whose image is a figure eight; $\beta$ is not a homeomorphism onto its image, because $\beta(t)\to(0,0)=\beta(0)$ as $t\to\pm\pi$. Injective immersions are not yet embeddings; the missing condition returns in unit 3 with submanifolds.

## What to carry forward

Smooth maps are tested in charts, and one atlas on each side suffices. The Hausdorff and second countability axioms are independent of the atlas; the line with two origins and the long line are the standard witnesses. Distinct smooth structures can define diffeomorphic manifolds. The differential of a map between vector spaces is the unique linear approximation, and the rank of a map between manifolds is a chart-independent integer; immersions and submersions are the two extreme ranks. Next unit: the inverse and implicit function theorems, regular values and submanifolds.
