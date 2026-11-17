# Fibre bundles and the medium Whitney theorem

Vector bundles have linear fibres and linear change-of-frame maps. A fibre bundle keeps the local product condition but permits another manifold as its fibre. This broader language makes the space of tangent directions into a manifold, exactly what the next projection proof needs.

Read MIT 18.965 [Lecture 13, Definition 14.2](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture13.pdf), and [Lecture 14, Theorem 15.1 and Proposition 15.3](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture14.pdf). Two source slips matter: the fibre of the frame-to-plane map is $GL(k,\mathbb R)$, not the entire space of injections into $\mathbb R^n$; the tangent-direction bad set in Lecture 14 has measure **zero**, not full measure. Derive both facts below rather than memorising the printed sentences.

## A local product with one fixed fibre

A smooth fibre bundle $p:E\to B$ with fibre $F$ has, near each $b$, a diffeomorphism $p^{-1}(U)\cong U\times F$ respecting projection to $U$. This trivializes the whole inverse image of the neighbourhood, not merely a small neighbourhood of one point in the total space. Bundle maps over overlaps are diffeomorphisms of $F$ depending smoothly on the base point. They need not be linear, and the fibres need not even be vector spaces.

A bundle projection is a surjective submersion (assuming nonempty fibre). The converse is false. The projection
$$\mathbb R^2\setminus\{(0,0)\}\longrightarrow\mathbb R,\qquad (x,y)\mapsto x$$
is a surjective submersion, but its fibre over zero is $\mathbb R\setminus\{0\}$ with two components, while all other fibres are connected copies of $\mathbb R$. No neighbourhood of zero has one fixed fibre type. The constant-rank theorem describes a small product near an individual point; it does not trivialize an entire fibre at once. Proper surjective submersions do give fibre bundles (Ehresmann's theorem), but its proof is outside this course and it is not used to justify the example below.

## Worked example: frames over a Grassmannian

Write $\mathrm{St}_k(\mathbb R^n)$ for ordered linearly independent $k$-frames, equivalently injective maps $j:\mathbb R^k\to\mathbb R^n$. This is the nonorthonormal convention used in these notes. Sending a frame to its span gives $p:\mathrm{St}_k\to\mathrm{Gr}_k$. Fix a plane $L_0$, identify it with $\mathbb R^k$, and use graph coordinates $A:L_0\to L_0^\perp$ for nearby planes. A frame in $\operatorname{graph}A$ is uniquely
$$j=(I+A)\circ C,\qquad C:\mathbb R^k\xrightarrow{\cong} L_0.$$
Thus $(A,C)$ are local product coordinates and $C\in GL(k,\mathbb R)$. Projection onto $L_0$ recovers $C$, and the graph chart recovers $A$, so the maps in both directions are smooth. The dimensions agree:
$$k(n-k)+k^2=nk,$$
the dimension of the open set of injective matrices. With *orthonormal* frames the fibre would instead be $O(k)$; switching conventions mid-proof changes dimensions.

For a rank-$k$ vector bundle $E$, its projectivization $P(E)$ has fibre $\mathbb{RP}^{k-1}$. In a local trivialization, send the line $\ell\subset E_x$ to its coordinate line. A transition matrix acts smoothly on projective space, so these charts glue. In particular, for $n\ge1$,
$$\dim P(TM)=n+(n-1)=2n-1.$$
The point of projectivization is to forget vector length and sign while retaining a direction that a projection could kill.

## Two independent obstructions to a good projection

Start from the embedding $i:M^n\hookrightarrow\mathbb R^N$ constructed in unit5, with $M$ compact. For a line $L$, let $\pi_L$ be orthogonal projection onto $L^\perp$.

First, $\pi_Li(x)=\pi_Li(y)$ for $x\ne y$ exactly when $L$ is the line spanned by $i(x)-i(y)$. The smooth secant map
$$s:(M\times M)\setminus\Delta\longrightarrow\mathbb{RP}^{N-1},\quad s(x,y)=[i(x)-i(y)]$$
has domain dimension $2n$. The deleted diagonal makes the formula defined; its domain need not be compact, and Sard still applies because it is second countable.

Second, $d(\pi_Li)_x(v)=0$ for a nonzero tangent vector precisely when $L=[di_xv]$. The tangent map
$$t:P(TM)\longrightarrow\mathbb{RP}^{N-1},\quad t(x,[v])=[di_xv]$$
is smooth and well-defined because $i$ is an immersion. Its domain has dimension $2n-1$.

If $N>2n+1$, both domain dimensions are strictly smaller than $N-1$. Every point of each map is therefore critical. Sard says both images are null. Choose a line outside their union. The projected map is injective and immersive, and compact-to-Hausdorff makes it an embedding. Identify $L^\perp$ with $\mathbb R^{N-1}$ and repeat until the target has dimension $2n+1$.

This proves the **medium Whitney theorem** for compact smooth manifolds of positive dimension. A compact zero-dimensional manifold is a finite discrete set and embeds in $\mathbb R$, consistent with the $2n+1$ bound. It needs separate wording because $P(TM)$ then has empty fibres.

## Worked example: why crossing and tangency are separate

Take a round circle in the $xy$-plane of $\mathbb R^3$. Projection along the $z$-axis preserves the circle exactly. Projection along the $x$-axis collapses points with the same $y$-coordinate and kills the tangent vector at the top and bottom. For a space curve, a projection may have transverse crossings even when no tangent vector is killed. Checking the derivative alone only proves an immersion.

At target dimension $2n+1$, the tangent-direction domain still has dimension $2n-1<2n$. Choose a line avoiding it and project once more to $\mathbb R^{2n}$. This proves an **immersion** into $\mathbb R^{2n}$. The secant domain now has dimension $2n$, equal to the direction space dimension; Sard no longer forces its image to be null. The next unit on transversality explains how to arrange controlled double points. Removing them requires additional geometry, not a stronger interpretation of the same inequality.

A complete proof portfolio should keep four checks visible: smoothness of the direction maps, the strict dimension comparison, the two distinct differential/set-theoretic obstructions, and the compactness argument for topology. “Generic projection works” abbreviates those checks; it cannot replace them.
