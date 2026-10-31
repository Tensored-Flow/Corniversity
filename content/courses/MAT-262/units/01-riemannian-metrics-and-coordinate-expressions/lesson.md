## Conventions, stated once

Every computation in this course uses the following conventions; state them yourself at the top of every submission.

- Manifolds are smooth, Hausdorff and second countable, of dimension $n$. In a chart $(U,x)$ the coordinate vector fields are $\partial_i=\partial/\partial x^i$ and the coordinate 1-forms are $dx^i$; coordinate indices are upper on points and vector components, lower on covector components.
- Einstein summation: a repeated index, once upper and once lower, is summed from $1$ to $n$.
- A Riemannian metric has components $g_{ij}=g(\partial_i,\partial_j)$; the matrix $(g_{ij})$ is symmetric and positive definite, its inverse is written $(g^{ij})$, and $g=g_{ij}\,dx^i\otimes dx^j$ (we write $dx^idx^j$ for the symmetric product). The signature is $(+,\dots,+)$ throughout.
- A *Lorentzian* metric, signature $(-,+,+,+)$, is **not** a Riemannian metric. It appears in this course only where it is named, in exercise 3 of this unit and in unit 9, to mark what does and does not carry over.

## Riemannian metrics

**Definition (Riemannian metric).** A Riemannian metric on a smooth manifold $M$ is a smooth tensor field $g$ of type $(0,2)$ such that for every $p\in M$ the bilinear form $g_p:T_pM\times T_pM\to\mathbb{R}$ is an inner product: symmetric and positive definite. The pair $(M,g)$ is a *Riemannian manifold*; properties of $(M,g)$ determined by $g$ alone are *intrinsic* (Gudmundsson, Definition 5.5).

Smoothness of $g$ means that in every chart the functions $g_{ij}=g(\partial_i,\partial_j)$ are smooth; equivalently $g(X,Y)$ is smooth for all smooth vector fields $X,Y$. For $v=v^i\partial_i$ and $w=w^j\partial_j$ at a point,
$$g(v,w)=g_{ij}\,v^iw^j,\qquad |v|=\sqrt{g(v,v)}.$$

**Example (Euclidean space).** $E^n=(\mathbb{R}^n,\langle\cdot,\cdot\rangle)$ with $\langle X,Y\rangle=X^tY=\sum_kX^kY^k$, so $g_{ij}=\delta_{ij}$ in the standard chart (Example 5.6).

**Definition (arc length).** For a $C^1$ curve $\gamma:I\to M$, $L(\gamma)=\int_I\sqrt{g(\dot\gamma(t),\dot\gamma(t))}\,dt$ (Definition 5.7).

**Proposition.** $L$ is unchanged by reparametrisation.

**Proof.** If $\tilde\gamma=\gamma\circ\sigma$ with $\sigma:J\to I$ a $C^1$ bijection with $\sigma'>0$, then $\dot{\tilde\gamma}(s)=\sigma'(s)\dot\gamma(\sigma(s))$, so $|\dot{\tilde\gamma}(s)|=\sigma'(s)|\dot\gamma(\sigma(s))|$ by homogeneity of the norm, and the substitution $t=\sigma(s)$ gives $\int_J|\dot{\tilde\gamma}|\,ds=\int_I|\dot\gamma|\,dt$. For $\sigma'<0$ the same holds with $|\sigma'|$. $\square$

Taking the infimum of lengths of curves joining $p$ to $q$ gives a distance function $d$, and Proposition 5.10 states that $(M,d)$ is a metric space whose topology is the manifold topology; the notes defer the proof to Petersen's book, and we prove it in unit 4 once geodesics are available.

## Metric coefficients and the change of chart

If $(U,x)$ and $(V,y)$ are charts with $U\cap V\neq\varnothing$, the chain rule gives $\partial/\partial y^a=(\partial x^i/\partial y^a)\,\partial/\partial x^i$ on $U\cap V$, hence
$$\tilde g_{ab}=g\Big(\frac{\partial}{\partial y^a},\frac{\partial}{\partial y^b}\Big)=\frac{\partial x^i}{\partial y^a}\frac{\partial x^j}{\partial y^b}\,g_{ij},\qquad\text{i.e.}\qquad \tilde G=J^{t}GJ,\quad J=\Big(\frac{\partial x^i}{\partial y^a}\Big).$$
Two consequences follow at once: $\det\tilde G=(\det J)^2\det G$, and positive definiteness of $(g_{ij})$ at a point is a chart-independent statement, since a congruence $J^tGJ$ with $J$ invertible preserves it. Exercise 2 asks you to prove these carefully and to apply them to polar coordinates, where $\det J$ vanishes along a line that the coordinates fail to cover.

## Induced metrics and parametrisations

**Definition (induced metric).** If $(N,h)$ is Riemannian and $M\subseteq N$ is a submanifold, then $g(X,Y)=h(X,Y)$ for $X,Y$ tangent to $M$ defines a Riemannian metric on $M$, the *induced metric* (Definition 5.11). Positive definiteness is inherited because $T_pM\subseteq T_pN$ and $h_p$ is positive definite on all of $T_pN$.

The computational form of this definition is the one you will use most. Let $M\subseteq\mathbb{R}^N$ carry the metric induced by the Euclidean inner product and let $F:U\to\mathbb{R}^N$ be a *local parametrisation*: $U\subseteq\mathbb{R}^n$ open, $F$ a smooth injective immersion whose image is open in $M$ and whose inverse $F^{-1}$ is a chart of $M$. The coordinate vector field $\partial_i$ of that chart is, as a vector in $\mathbb{R}^N$, the partial derivative $\partial_iF$, so
$$g_{ij}=\langle\partial_iF,\partial_jF\rangle .$$
This is the classical first fundamental form, and Remark 5.30 of the notes phrases it as the pull-back metric $F^*g$ on $U$.

**Example (a graph).** For $f:U\to\mathbb{R}$ smooth on $U\subseteq\mathbb{R}^2$, the graph $z=f(x,y)$ is parametrised by $F(x,y)=(x,y,f(x,y))$, with $\partial_xF=(1,0,f_x)$ and $\partial_yF=(0,1,f_y)$. Hence
$$g=(1+f_x^2)\,dx^2+2f_xf_y\,dx\,dy+(1+f_y^2)\,dy^2,\qquad\det(g_{ij})=1+f_x^2+f_y^2>0 .$$
The unit sphere in stereographic coordinates is treated in the notes as the "punctured round sphere" $\big(\mathbb{R}^n,\tfrac{4}{(1+|x|^2)^2}\langle\cdot,\cdot\rangle\big)$ (Example 5.8 and Exercise 5.2); read it, but do the sphere of radius $R$ in exercise 1 in spherical coordinates yourself first.

## Where a parametrisation stops being a chart

Many familiar coordinate systems are parametrisations on an open set that extend smoothly to a larger set on which they are no longer injective immersions. The metric coefficients then degenerate, and it is essential to read that degeneration correctly.

**Proposition (Gram criterion).** Let $F:U\to\mathbb{R}^N$ be smooth and $u\in U$. The vectors $\partial_1F(u),\dots,\partial_nF(u)$ are linearly independent if and only if the Gram matrix $G(u)=\big(\langle\partial_iF(u),\partial_jF(u)\rangle\big)$ is positive definite, if and only if $\det G(u)>0$.

**Proof.** For $c\in\mathbb{R}^n$, $c^tG(u)c=\big|\sum_ic^i\partial_iF(u)\big|^2\ge0$, with equality iff $\sum_ic^i\partial_iF(u)=0$. So $G(u)$ is positive semidefinite always, and positive definite iff the only vanishing combination is $c=0$, i.e. iff the vectors are independent. A positive semidefinite matrix is positive definite iff its determinant is positive (its eigenvalues are nonnegative, and all are positive iff their product is). $\square$

**Warning (coordinate singularities).** Consequently $\det(g_{ij})\to0$ along the boundary of a parametrisation's domain signals exactly that $dF$ loses rank there, that is, that $F$ ceases to be a chart. It says nothing about $M$ or about $g$, which may be perfectly smooth and positive definite at the points in question, as another chart will show. Polar coordinates on the plane at $r=0$ and spherical coordinates on the sphere at the poles are the standard cases; exercises 1 and 2 ask you to separate, in writing, the statement about the coordinates from the statement about the geometry. The persona's rule applies: a chart is a tool with a domain.

## Isometries, conformal maps and homogeneous spaces

**Definition.** A map $\varphi:(M,g)\to(N,h)$ is *conformal* if $h(d\varphi X,d\varphi Y)=e^{2\lambda}g(X,Y)$ for some function $\lambda$ on $M$, *isometric* if $\lambda\equiv0$, and an *isometry* if it is an isometric diffeomorphism (Definition 5.17). The isometries of $(M,g)$ form the isometry group $\mathrm{Iso}(M)$, and $(M,g)$ is *homogeneous* if that group acts transitively (Definitions 5.18 and 5.20).

**Example.** $SO(n+1)$ acts on $S^n\subseteq E^{n+1}$ by matrix multiplication; $\langle Ax,Ay\rangle=\langle x,y\rangle$ shows the action is isometric for the induced metric, and it is transitive, so the round sphere is homogeneous (Example 5.21). Isometries preserve lengths of curves and hence the distance $d$; conformal maps preserve angles. Exercise 5.2 of the notes shows stereographic projection is an isometry between the punctured sphere and the conformally flat model.

**Example (frames).** In a chart, $\{\partial_1,\dots,\partial_n\}$ is a frame of $TM$ over $U$, and Gram–Schmidt applied pointwise produces a local orthonormal frame $\{E_1,\dots,E_n\}$ with $g(E_i,E_j)=\delta_{ij}$ (Example 5.32). Orthonormal frames trade the simplicity $g_{ij}=\delta_{ij}$ for non-vanishing brackets $[E_i,E_j]$; coordinate frames trade commuting fields for general $g_{ij}$. Both will be used.

## Every manifold carries a metric

**Theorem.** Every smooth manifold admits a Riemannian metric (Theorem 5.16).

**Proof.** Take a locally finite cover by chart domains $W_\beta$ with a subordinate smooth partition of unity $(f_\beta)$, which exists because $M$ is Hausdorff and second countable (Fact 5.15; MAT-261 unit 5). On each $W_\beta$ let $g_\beta$ be the Euclidean metric transported by the chart, extended by $0$ outside the support of $f_\beta$, and put $g=\sum_\beta f_\beta g_\beta$. The sum is locally finite, so $g$ is a smooth symmetric tensor field, and at each $p$ it is a convex combination (coefficients $f_\beta(p)\ge0$ summing to $1$, at least one positive) of inner products, hence an inner product. $\square$

Note the two places positive definiteness entered: a nonnegative combination of positive definite forms with at least one positive coefficient is positive definite. Exercise 3 asks what happens to this argument, and to the arc-length and distance constructions, when "positive definite" is replaced by "nondegenerate of signature $(-,+,+,+)$".

## What to carry forward

A Riemannian metric is a smoothly varying inner product; in a chart it is a symmetric positive definite matrix $(g_{ij})$ that transforms by congruence under change of coordinates; on a submanifold of Euclidean space it is computed as the Gram matrix of the partial derivatives of a parametrisation, and that Gram matrix degenerates exactly where the parametrisation stops being a chart. Lengths, the distance function, isometries and conformal maps are defined from $g$; every manifold has a metric. Next unit: the Levi-Civita connection, the unique way to differentiate vector fields compatibly with $g$, and its Christoffel symbols.
