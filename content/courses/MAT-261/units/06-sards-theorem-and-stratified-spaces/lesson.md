# Sard's theorem and stratified spaces

Regular values let equations cut out manifolds. Sard's theorem says the values where this method fails form a measure-zero subset of the target. This is a statement about **values**, not about the size of the critical-point set in the domain; a constant function has every point critical and only one critical value.

Read MIT 18.965 [Lectures 10–11, Theorem 12.3 and its three-step proof](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture10_11.pdf), and [Lecture 12, Proposition 13.2 and the rank-stratum application](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture12.pdf). The source proof has some index slips; use the dimensions written below. Its Lemma 12.2, asserting measurability of every continuous image of a measurable set, is too broad. Our application uses countable unions of compact images, which are Borel, and does not use that blanket assertion.

## What measure zero means on a manifold

A set in an $n$-manifold has measure zero if its image in every coordinate chart has Lebesgue outer measure zero. This is chart independent: on relatively compact coordinate pieces a smooth transition map has bounded derivative, hence is Lipschitz; Lipschitz maps between equal-dimensional Euclidean spaces preserve null sets by a cube-cover estimate. Countably many such pieces cover an overlap. Second countability reduces local null-set conclusions to a countable union globally.

For a smooth $f:M^m\to N^n$, $n\ge1$, Sard says $f(C)$ is null, where $C=\{x:\operatorname{rank}df_x<n\}$. Values outside the image are regular too. If $m<n$, every point is critical, so the whole image is null. This does not make $f$ constant: an embedded curve in a plane is the familiar example. Smoothness is important; the sharpened finite-regularity version requires $C^r$ with $r>\max(m-n,0)$ and is not proved here.

## The proof: reduce dimension or make the image small

We describe the smooth proof in Euclidean charts and require you to reconstruct its details from Theorem 12.3. Induct on the domain dimension $m$. Let $C_j$ be the set where every derivative of orders one through $j$ vanishes. Then split the critical set into $C\setminus C_1$, the sets $C_j\setminus C_{j+1}$, and a remainder $C_k$ for a sufficiently large $k$.

At a point of $C\setminus C_1$, some first partial derivative is nonzero. Use that component of $f$ as a source coordinate by the inverse theorem. In these coordinates $f(t,z)=(t,h(t,z))$. For each fixed $t$, criticality of $f$ is equivalent to criticality of $z\mapsto h(t,z)$ from dimension $m-1$ to dimension $n-1$. Induction and Fubini show that the critical image in this neighbourhood is null. If $n=1$, this part of the critical set is empty. Work first on compact pieces so the image under discussion is measurable, then take a countable exhaustion.

At a point of $C_j\setminus C_{j+1}$, some derivative $w$ of order $j$ vanishes there but has a nonzero first derivative. The set $w=0$ is a smooth hypersurface and contains $C_j$ locally. Restrict $f$ to that hypersurface. Its derivative vanishes at the points under consideration, so they are critical points for a map with domain dimension $m-1$. Induction handles their image. Countably many such neighbourhoods suffice.

Finally restrict to a compact cube with a slightly larger compact neighbourhood on which derivatives of order $k+1$ are bounded. Subdivide into cubes of side $\delta$. If a small cube meets $C_k$, Taylor expansion at a point in that intersection shows its image has diameter at most $A\delta^{k+1}$. There are $O(\delta^{-m})$ cubes, so the total target covering volume is at most $B\delta^{n(k+1)-m}$. Choose $n(k+1)>m$ and let $\delta\to0$. This is the estimate that turns high-order flatness into small image volume. The proof is not that every critical point is isolated; it works even when the critical set is large.

**Worked example.** For $f(x,y)=x^2-y^2$, the only critical point is $(0,0)$ and the only critical value is $0$. Positive and negative level sets are one-dimensional submanifolds. The zero level is the crossing of two lines, which is not a one-dimensional manifold at the origin. For $g(x,y)=x^2$, the critical set is an entire line, but the critical-value set is still just $\{0\}$.

## Rank strata: a singular space made of smooth pieces

In the space of $n\times k$ matrices, fix rank $r$ and reorder rows and columns so an $r\times r$ block $A$ is invertible. A nearby matrix has blocks
$$B=\begin{pmatrix}A&P\\Q&D\end{pmatrix}.$$
Invertible row and column operations show
$$\operatorname{rank}B=r+\operatorname{rank}(D-QA^{-1}P).$$
Consequently rank exactly $r$ is locally the zero set of $D-QA^{-1}P$. Differentiating with respect to $D$ gives the identity, so this is a regular system of $(n-r)(k-r)$ equations. The rank-$r$ stratum has dimension $nk-(n-r)(k-r)=r(n+k-r)$.

The closure is the set of rank at most $r$, because limits cannot increase rank (all larger minors vanish), and a lower-rank matrix is a limit of rank-$r$ matrices by adding small diagonal entries in suitable bases. This closure is generally singular. We use “stratum” for the smooth fixed-rank piece, and “closed rank locus” for its closure; the source uses a different terminology. We are not asserting the full Whitney stratification conditions merely from this frontier property.

**Worked example.** The rank-one $2\times2$ matrices have dimension three. The locus $\det B=0$ also contains the zero matrix, where the derivative of determinant vanishes and different rank-one directions meet. The smooth rank-one stratum and its singular closure must not be confused.

## Avoiding a bad set by perturbation

Let $h:D^d\to\mathbb R^{nk}$ be a smooth map, and suppose a closed bad set is a finite union of smooth rank strata of codimension greater than $d$. For one stratum $S$, the map $H(A,x)=A+h(x)$ is a submersion because variation in $A$ covers the target. Thus $H^{-1}(S)$ has dimension $nk+d-\operatorname{codim}S<nk$. Sard applied to its projection onto the $A$-space says the parameters for which $A+h(x)$ meets $S$ form a null set. For a disk use its interior and boundary as separate manifolds; the boundary has smaller dimension. A finite union remains null, so arbitrarily small good translations exist.

If $h$ already avoids the bad set on the boundary, compactness gives a positive distance there; choose $A$ small enough that the entire boundary homotopy $h(x)+tA$ continues to avoid it. This is the mechanism behind the Stiefel connectivity application, not a claim that a perturbation fixes the boundary pointwise. For continuous homotopy classes, a smooth-approximation theorem is an additional input and must be stated when used.
