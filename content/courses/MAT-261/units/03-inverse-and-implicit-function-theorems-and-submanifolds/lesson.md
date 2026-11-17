# Inverse and implicit function theorems; submanifolds

Calculus becomes geometry when a derivative tells us the shape of a solution set. An invertible derivative lets us change coordinates; a surjective derivative lets us regard equations as some of those coordinates. The conclusions are local. Much of the work in this unit is keeping that word in the argument.

Read MIT 18.965 [Lecture 4, Theorems 5.1–5.2 and Corollary 5.4](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture4.pdf) and [Lecture 5, the orthogonal-group calculation](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture5.pdf). Lecture 5's ODE discussion is unfinished; the local argument below supplies the missing existence and uniqueness statement. Hitchin §10.1 is a second reference for the inverse theorem.

## A nonlinear equation as a contraction

Let $F:U\subset E\to F_0$ be $C^1$ between Banach spaces, and suppose $DF(a)$ is a bounded linear isomorphism. Translate source and target and compose with its inverse. We may assume $a=0$, $F(0)=0$, $DF(0)=I$, with source and target the same Banach space. Write $F(x)=x+g(x)$. By continuity of $Dg$, choose a closed ball $\overline B_r$ inside the domain on which $\|Dg\|\le1/2$. The segment integral estimate gives $\|g(x)-g(x')\|\le\frac12\|x-x'\|$.

For $\|y\|<r/2$, the map $T_y(x)=y-g(x)$ preserves the closed ball and contracts distances by at most $1/2$. Iteration from any point of the ball converges: successive differences form a geometric series, completeness supplies a limit, and continuity makes it a fixed point. Two fixed points would have distance at most half their own distance, so they coincide. Call the solution $h(y)$. Comparing its equations for $y,y'$ gives $\|h(y)-h(y')\|\le2\|y-y'\|$.

This initially constructs an inverse on a neighbourhood, not on all of $U$. Shrink the source to the open preimage of a small target ball. The estimate also allows us to upgrade the inverse: subtract the linear approximation to $F$ at $x=h(y)$ to obtain
$$h(y+k)-h(y)=DF(h(y))^{-1}k+o(\|k\|).$$
Nearby derivatives remain invertible by the Neumann-series argument. Thus $Dh(y)=DF(h(y))^{-1}$ is continuous. Repeated differentiation gives the smooth version. Completeness enters the fixed-point step; continuity of the derivative supplies a uniform contraction near the point.

**Worked example.** The map $F(x,y)=(e^x\cos y,e^x\sin y)$ has determinant $e^{2x}\ne0$ everywhere. It is locally invertible everywhere but $F(x,y+2\pi)=F(x,y)$. There is no contradiction: no local inverse theorem supplies injectivity between distant points.

## Equations become coordinates

Suppose $f:E\supset U\to F_0$ is smooth, $f(a)=b$, and $Df(a)$ is surjective with kernel $K$ admitting a closed complement $C$. In finite dimensions the complement exists automatically. In Banach spaces it is an extra hypothesis. The restriction $A=Df(a)|_C:C\to F_0$ is a bounded isomorphism by the open mapping theorem. In translated coordinates define
$$H(k,c)=(k,A^{-1}(f(a+k+c)-b)).$$
Its derivative at zero is the identity. The inverse theorem therefore gives local coordinates in which $f$ is projection to the second factor, followed by $A$ and translation. In particular $f^{-1}(b)$ locally looks like $K\times\{0\}$.

For finite-dimensional manifolds, a value $b$ is **regular** if $df_x$ is surjective at every $x\in f^{-1}(b)$. A value with empty inverse image is regular by this convention. The regular-value theorem gives an embedded submanifold of dimension $\dim M-\dim N$ when the inverse image is nonempty; its tangent space is $\ker df_x$. It does not say every submanifold must be presented globally by one system of equations.

**Worked example.** For $f(x)=\|x\|^2$ on $\mathbb R^{n+1}$, $df_x(v)=2\langle x,v\rangle$. Every positive value is regular; the unit sphere has tangent space $x^\perp$. At value zero the theorem is unavailable, although the inverse image is the single point $0$, which happens to be a manifold of a different dimension. Failure of a hypothesis is not proof that the conclusion fails.

## Matrix groups: choosing the target correctly

Take $q:M_n(\mathbb R)\to\operatorname{Sym}_n(\mathbb R)$, $q(A)=AA^T$. Expansion in $t$ gives $Dq_A(B)=BA^T+AB^T$. At an orthogonal $A$, any symmetric $S$ is obtained by taking $B=SA/2$. Thus $I$ is regular, and
$$\dim O(n)=n^2-\frac{n(n+1)}2=\frac{n(n-1)}2.$$
Moreover $T_AO(n)=\{KA:K^T=-K\}$. Using all matrices as the target would falsely demand surjectivity onto nonsymmetric directions which $q$ never reaches. This is an example where correctly specifying the codomain is the central mathematical decision.

## Local ODE existence and its boundary

Let $X$ be a smooth vector field on an open subset of $\mathbb R^n$, and fix $a$. Choose a closed ball around $a$ inside the domain on which $\|X\|\le M$ and $X$ is Lipschitz with constant $L$. On continuous paths in that ball with the supremum norm, consider
$$(T\gamma)(t)=a+\int_0^tX(\gamma(s))\,ds,\qquad |t|\le\tau.$$
For $M\tau$ smaller than the radius, $T$ stays in the path set; for $L\tau<1$, it contracts. The fixed path is $C^1$ and solves the ODE. The integral equation proves uniqueness for nearby paths, and overlapping local solutions patch to a unique maximal solution. Coordinate changes preserve this construction by the chain rule.

The solution of $x'=x^2$, $x(0)=1$, is $x(t)=1/(1-t)$ and blows up at time $1$. Smoothness of a vector field does not imply completeness of its flow. On compact manifolds every smooth vector field is complete: a finite collection of local existence neighbourhoods provides a uniform continuation time whenever a solution approaches a finite endpoint. The distinction will matter when we use flows in Frobenius' theorem.

Before the sheet, reproduce the argument from surjective derivative to local level-set coordinates. Identify exactly which statement changes when the domain is infinite-dimensional. Your synthesis should connect that local calculation to the topology needed for a global embedding; rank calculations alone do not settle global behaviour.
