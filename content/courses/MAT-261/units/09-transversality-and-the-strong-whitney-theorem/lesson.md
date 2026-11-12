# Transversality and the strong Whitney theorem

Two submanifolds meet transversely when their tangent spaces together fill the ambient tangent space. This condition makes the intersection stable under small local perturbations and gives its expected dimension. It allows crossings; it does not mean disjointness.

Read MIT 18.965 [Lecture 20, Definition 18.1 and Theorems 18.3 and 18.5](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture20.pdf), and [Lectures 21–22, Theorem 19.1 and Proposition 19.4](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture21_22.pdf). The strong Whitney argument there is explicitly a sketch. We prove the transversality machinery and the control of double points; the full low-dimensional and surgery details of the strong embedding theorem are stated as a further theorem, not represented as proved by a dimension count.

## Turning intersection into a regular-value problem

For $f:M\to N$ and an embedded submanifold $Z\subset N$, write $f\pitchfork Z$ if, for every $x$ with $f(x)\in Z$,
$$df_x(T_xM)+T_{f(x)}Z=T_{f(x)}N.$$
There is no condition at points mapping outside $Z$. If $Z$ is locally given by a submersion $q$ with $Z=q^{-1}(0)$, this is exactly surjectivity of $d(qf)_x$. The regular-value theorem gives
$$f^{-1}(Z)\text{ a submanifold of codimension }\operatorname{codim}_N Z.$$
Its tangent space is $df_x^{-1}(T_{f(x)}Z)$. A negative expected dimension forces an empty inverse image; zero dimension gives a discrete submanifold, and compactness is still needed to conclude finiteness.

**Worked example.** The curve $t\mapsto(t,t^2)$ meets the horizontal axis at zero with tangent lying in the axis, so the intersection is not transverse. Replacing it by $t\mapsto(t,t^2-\varepsilon)$ gives two transverse intersections for $\varepsilon>0$, none for $\varepsilon<0$. The exceptional parameter zero is exactly where the two solutions merge. Regularity explains the persistence of the individual nondegenerate solutions near a fixed positive parameter.

## Parameters let us use Sard once more

Let $F:P\times M\to N$ be smooth between finite-dimensional second-countable manifolds and transverse to $Z$; a total submersion is a convenient sufficient condition. Set $W=F^{-1}(Z)$ and $\pi:W\to P$. For fixed $p$, let $f_p(x)=F(p,x)$. Then
$$p\text{ is regular for }\pi\quad\Longleftrightarrow\quad f_p\pitchfork Z.$$
To prove this, quotient the derivative of $F$ by $T_zZ$ and call the resulting surjection $A:T_pP\oplus T_xM\to T_zN/T_zZ$. The tangent space of $W$ is $\ker A$. Projection $\ker A\to T_pP$ is onto exactly when every parameter vector $v$ can be paired with $w$ satisfying $A(v,w)=0$. Since $A$ is onto, this is equivalent to the restricted map $w\mapsto A(0,w)$ being onto. That is slice transversality.

Sard applied to $\pi$ says the bad parameters form a null subset in finite-dimensional parameter charts. Thus good parameters are dense. Smooth finite-dimensional maps on second-countable manifolds have critical images covered by countably many compact null images, so the regular values also contain a countable intersection of open dense sets. Do not transfer this measure statement to an infinite-dimensional function space.

**Worked example.** For any smooth $f:M\to\mathbb R^q$, the family $F(a,x)=f(x)+a$ is a submersion. For any fixed embedded $Z\subset\mathbb R^q$, arbitrarily small translations make $f+a$ transverse to $Z$. If $\operatorname{codim}Z>\dim M$, these good translates miss $Z$ entirely. If dimensions permit an intersection, the theorem does not promise its removal.

## The Banach version and a useful index check

Suppose now $P,M,N$ are second-countable Banach manifolds, the total $F$ is a **split submersion**, every slice $f_p$ is a smooth Fredholm map, and $Z\subset N$ is finite-dimensional. Then $W$ is a split submanifold and the projection $\pi:W\to P$ is Fredholm. Sard–Smale gives residual good parameters. At a point, let $L=d f_p$ and let $V=T_zZ$. The kernel of $d\pi$ is $L^{-1}(V)$, which fits into
$$0\to\ker L\to L^{-1}(V)\xrightarrow{L}\operatorname{ran}L\cap V\to0.$$
The last term is the intersection, **not all of $V$** in general. The cokernel is $T_zN/(\operatorname{ran}L+V)$. These spaces are finite-dimensional, the range is closed by the Fredholm splitting, and
$$\operatorname{ind}(d\pi)=\operatorname{ind}L+\dim V.$$
The displayed short exact sequence repairs an overstrong surjectivity claim in the source proof.

The usual smooth transversality theorem says transverse smooth maps are residual in the appropriate smooth mapping-space topology; on a compact source one uses the $C^\infty$ topology, and transversality to a closed target submanifold is also open in the $C^1$ topology. A proof builds finite-dimensional local perturbation families and applies the parameter theorem on a countable exhaustion. This mapping-space theorem is an assigned consequence, not a direct application treating the Fréchet space $C^\infty(M,N)$ as a Banach space. Finite-$C^r$ variants require differentiability bounds; the unqualified all-$k$ wording in the source should not be used.

## What happens to an immersion in dimension 2n

For an immersion $i:M^n\to\mathbb R^{2n}$, study
$$D:(M\times M)\setminus\Delta\to\mathbb R^{2n},\qquad D(x,y)=i(x)-i(y).$$
Transversality to zero means $di_x(T_xM)+di_y(T_yM)=\mathbb R^{2n}$ whenever the images agree. Its zero set has dimension zero, so double pairs are isolated. If $M$ is compact, local injectivity of an immersion gives a neighbourhood of the diagonal containing no double pair: cover $M$ by finitely many sets on which $i$ is injective and use a Lebesgue number for a compatible metric. Thus the double-pair set is a closed discrete subset of a compact complement of that neighbourhood, hence finite. Compactness of $M\times M$ alone, without excluding accumulation at the deleted diagonal, would leave a gap.

For a self-transverse immersion, two crossing sheets can be straightened locally to complementary coordinate planes by the inverse theorem. Parametric transversality applied also to distinct triples gives no triple points generically when $n>0$: the distinct-triple domain has dimension $3n$ and coincidence imposes $4n$ conditions. This application uses independent local perturbations near the distinct source points.

## The extra geometry behind the strong theorem

The **strong Whitney embedding theorem** states that a compact smooth $n$-manifold, $n\ge1$, embeds in $\mathbb R^{2n}$. For $n=0$, a finite set with multiple points cannot embed in $\mathbb R^0$; use $\mathbb R$ instead. The source begins its sketch with orientable even $n>2$: transverse double points have signs, and an appropriately paired opposite-sign pair can be removed using a Whitney disk and a framed neighbourhood. Dimension inequalities allow the disk interior to avoid the sheets when $n>2$. Framing and signs are essential; a drawing of two crossing curves is not the complete argument. The remaining parity, orientation, and low-dimensional cases require further input.

The exact assigned source is Proposition 19.4 through the end of Lectures 21–22. Assessable here are the theorem statement, the fully proved transversality mechanism, the finite-double-point argument, and a clear account of what the Whitney move must accomplish. We do not ask you to certify the sketch as a complete proof for surfaces. In dimension one a compact manifold is a finite union of circles, readily embedded as disjoint planar circles; the surface case is part of the stated strong theorem. This boundary keeps the advanced result in view without hiding its additional proof obligations.
