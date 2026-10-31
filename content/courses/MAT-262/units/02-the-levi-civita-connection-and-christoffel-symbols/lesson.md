## The problem of differentiating a vector field

A Riemannian metric lets us measure vectors; to do geometry we must also differentiate them, and here a manifold offers no canonical way. If $Y=Y^j\partial_j$ is a vector field and we differentiate its components, $\partial_iY^j$, the result depends on the chart: under a change of coordinates the second derivatives of the transition map appear (Wendl, Exercise 1.1). On $\mathbb{R}^n$ the problem is invisible, because the directional derivative
$$(\partial_XY)(x)=\lim_{t\to0}\frac{Y(x+tX(x))-Y(x)}{t}$$
is available and has three algebraic properties: it is linear in $Y$, satisfies the Leibniz rule $\partial_X(fY)=X(f)Y+f\,\partial_XY$, and is $C^\infty$-linear in $X$: $\partial_{fX+gY}Z=f\partial_XZ+g\partial_YZ$. It has two further properties that tie it to the Euclidean metric (Gudmundsson, Proposition 6.1):
$$\partial_XY-\partial_YX=[X,Y],\qquad X\langle Y,Z\rangle=\langle\partial_XY,Z\rangle+\langle Y,\partial_XZ\rangle .$$
The whole of this unit is the statement that these five properties single out, on any Riemannian manifold, a unique differential operator.

## Connections

**Definition (connection).** Let $(E,M,\pi)$ be a smooth vector bundle. A *connection* on $E$ is an operator $\hat\nabla:C^\infty(TM)\times C^\infty(E)\to C^\infty(E)$, $(X,v)\mapsto\hat\nabla_Xv$, such that for $\lambda,\mu\in\mathbb{R}$, $f,g\in C^\infty(M)$, vector fields $X,Y$ and sections $v,w$:
1. $\hat\nabla_X(\lambda v+\mu w)=\lambda\hat\nabla_Xv+\mu\hat\nabla_Xw$;
2. $\hat\nabla_X(fv)=X(f)\,v+f\,\hat\nabla_Xv$;
3. $\hat\nabla_{fX+gY}v=f\hat\nabla_Xv+g\hat\nabla_Yv$.

A section $v$ is *parallel* if $\hat\nabla_Xv=0$ for all $X$ (Definition 6.2).

Property 3 says $\hat\nabla_Xv$ at $p$ depends only on $X_p$, so $\hat\nabla_{X_p}v$ makes sense for a single tangent vector; property 2 says the dependence on $v$ is first-order and local. (The notes prove in Remark 7.3 that $(\hat\nabla_Xv)(p)$ depends on $v$ only through its values along a curve with velocity $X_p$.) For the tangent bundle, $E=TM$, two further notions are available.

**Definition (torsion).** The *torsion* of a connection $\hat\nabla$ on $TM$ is $T(X,Y)=\hat\nabla_XY-\hat\nabla_YX-[X,Y]$; $\hat\nabla$ is *torsion-free* if $T\equiv0$ (Definition 6.3). No metric is involved.

**Definition (metric connection).** A connection on $TM$ is *metric*, or compatible with $g$, if $X\big(g(Y,Z)\big)=g(\hat\nabla_XY,Z)+g(Y,\hat\nabla_XZ)$ for all $X,Y,Z$ (Definition 6.4).

## The Koszul formula and the fundamental theorem

Suppose $\nabla$ is both metric and torsion-free. Metric compatibility, used three times with the arguments permuted, gives (Observation 6.5)
$$g(\nabla_XY,Z)=X g(Y,Z)-g(Y,\nabla_XZ),\qquad g(\nabla_XY,Z)=g([X,Y],Z)+Yg(X,Z)-g(X,\nabla_YZ),$$
$$0=-Zg(X,Y)+g(\nabla_XZ+[Z,X],Y)+g(X,\nabla_YZ-[Y,Z]),$$
where torsion-freeness was used to rewrite $\nabla_YX=\nabla_XY-[X,Y]$ and $\nabla_ZX=\nabla_XZ+[Z,X]$, $\nabla_ZY=\nabla_YZ-[Y,Z]$. Adding the three lines, the unknown terms $g(Y,\nabla_XZ)$ and $g(X,\nabla_YZ)$ cancel and we obtain the **Koszul formula**
$$2\,g(\nabla_XY,Z)=Xg(Y,Z)+Yg(Z,X)-Zg(X,Y)+g(Z,[X,Y])+g([Z,X],Y)+g([Z,Y],X).$$
The right-hand side involves only $g$ and brackets. Since $g$ is non-degenerate, $\nabla_XY$ is determined by its inner products with all $Z$: a metric torsion-free connection, if it exists, is unique.

**Definition (Levi-Civita connection).** The operator $\nabla$ defined by the Koszul formula (Definition 6.6) is the *Levi-Civita connection* of $(M,g)$.

**Theorem (fundamental theorem of Riemannian geometry).** $\nabla$ is a connection on $TM$ (Proposition 6.8), and it is the unique metric and torsion-free connection on $TM$ (Theorem 6.9).

**Proof.** That $\nabla$ is a connection is a direct verification of properties 1–3 from the Koszul formula; the only non-trivial points are the Leibniz rules in $Y$ and the $C^\infty$-linearity in $X$, where the derivative terms $X(f)g(Y,Z)$ and $Z(f)g(X,Y)$ produced by the brackets cancel against those produced by the first three terms (the notes write out both computations). Torsion-free: the right-hand side of the Koszul formula is, up to the term $g(Z,[X,Y])$, symmetric in $(X,Y)$, so $2g(\nabla_XY-\nabla_YX,Z)=2g([X,Y],Z)$ for all $Z$. Metric: the right-hand side is, up to the terms $Xg(Y,Z)+Xg(Z,Y)$, antisymmetric in $(Y,Z)$, so $2g(\nabla_XY,Z)+2g(Y,\nabla_XZ)=2Xg(Y,Z)$. Uniqueness was shown above. $\square$

The Levi-Civita connection is intrinsic: it depends only on the smooth structure and on $g$ (Remark 6.7). Exercise 3 asks what each of the two conditions contributes and what happens when one is dropped.

## Christoffel symbols

In a chart $(U,x)$ with coordinate frame $X_i=\partial_i$, define the *Christoffel symbols* $\Gamma^k_{ij}:U\to\mathbb{R}$ by
$$\nabla_{\partial_i}\partial_j=\Gamma^k_{ij}\,\partial_k \qquad\text{(direction of differentiation in the first lower index).}$$
Because $[\partial_i,\partial_j]=0$, torsion-freeness gives $\Gamma^k_{ij}=\Gamma^k_{ji}$. Applying the Koszul formula with $X=\partial_i$, $Y=\partial_j$, $Z=\partial_l$ (all brackets vanish) yields $2g_{kl}\Gamma^k_{ij}=\partial_ig_{jl}+\partial_jg_{il}-\partial_lg_{ij}$, and inverting the positive definite matrix $(g_{kl})$,
$$\Gamma^k_{ij}=\tfrac12\,g^{kl}\big(\partial_ig_{jl}+\partial_jg_{il}-\partial_lg_{ij}\big)$$
(Gudmundsson, Example 6.13). For a general field $Y=Y^j\partial_j$ one then has $\nabla_{\partial_i}Y=\big(\partial_iY^k+\Gamma^k_{ij}Y^j\big)\partial_k$.

**Example (the Euclidean plane in polar coordinates).** With $g=dr^2+r^2d\theta^2$ from unit 1, $g^{rr}=1$ and $g^{\theta\theta}=r^{-2}$, and the only non-zero derivative of a coefficient is $\partial_rg_{\theta\theta}=2r$. Hence
$$\Gamma^r_{\theta\theta}=\tfrac12g^{rr}(-\partial_rg_{\theta\theta})=-r,\qquad \Gamma^\theta_{r\theta}=\Gamma^\theta_{\theta r}=\tfrac12g^{\theta\theta}\,\partial_rg_{\theta\theta}=\frac1r,$$
and all other symbols vanish. Check against the directional derivative, which is the Levi-Civita connection of $E^2$ by Proposition 6.1 and uniqueness: in Cartesian components $\partial_r=(\cos\theta,\sin\theta)$ and $\partial_\theta=(-r\sin\theta,r\cos\theta)$, so $\partial_{\partial_\theta}\partial_\theta=\partial_\theta(-r\sin\theta,r\cos\theta)=(-r\cos\theta,-r\sin\theta)=-r\,\partial_r$ and $\partial_{\partial_r}\partial_\theta=(-\sin\theta,\cos\theta)=\tfrac1r\partial_\theta$, as the symbols predict. Exercise 1 carries out the same computation on the sphere of radius $R$.

**Warning (Christoffel symbols are not tensor components).** Under a change of chart $x\to y$,
$$\tilde\Gamma^c_{ab}=\frac{\partial y^c}{\partial x^k}\frac{\partial x^i}{\partial y^a}\frac{\partial x^j}{\partial y^b}\,\Gamma^k_{ij}+\frac{\partial y^c}{\partial x^k}\frac{\partial^2x^k}{\partial y^a\partial y^b},$$
and the second term is not tensorial. Consequences: the symbols can all vanish at a point in one chart and not in another; they can blow up where a chart degenerates although $\nabla$ is perfectly smooth (the polar $\Gamma^\theta_{r\theta}=1/r$ as $r\to0$ is the first instance, and the sphere provides another in exercise 1); and a statement about $\nabla$ must never be read off from the behaviour of the $\Gamma^k_{ij}$ alone.

## Submanifolds: the tangential connection

Let $(N,h)$ be Riemannian, $M\subseteq N$ a submanifold with the induced metric $g$, and $\nabla$ the Levi-Civita connection of $N$. For vector fields $\tilde X,\tilde Y$ on $M$ choose local extensions $X,Y$ to an open subset of $N$ (Definition 6.14, Fact 6.15) and decompose $\nabla_XY$ along $M$ into tangential and normal parts (Remark 6.16):
$$\tilde\nabla_{\tilde X}\tilde Y=(\nabla_XY)^\top,\qquad B(\tilde X,\tilde Y)=(\nabla_XY)^\perp .$$
Both are independent of the extensions (Remark 6.18), $B$ is the *second fundamental form* of $M$ in $N$ (Definition 6.19), and the notes state:

**Theorem.** $\tilde\nabla$ is the Levi-Civita connection of $(M,g)$ (Theorem 6.20), and $B$ is symmetric and $C^\infty(M)$-bilinear (Proposition 6.21).

The notes leave the proof as their Exercise 6.9; exercise 2 of this unit is that proof, organised around the fundamental theorem: show $\tilde\nabla$ is a connection, torsion-free and metric, and invoke uniqueness. The payoff is immediate for surfaces in $\mathbb{R}^3$, where $\nabla=\partial$ and $B$ recovers the classical shape operator (Example 6.23), and for the sphere, where the formula for $\tilde\nabla$ becomes explicit.

## Index conventions, restated

Upper index on $\Gamma$ is the output component; the first lower index is the direction of differentiation; $g^{kl}$ raises indices; summation over repeated upper–lower pairs. The signature is $(+,\dots,+)$: the Koszul formula and the Christoffel formula hold verbatim for any non-degenerate metric, Lorentzian included, but every statement in this unit that used positive definiteness (none, except that $g^{kl}$ exists) is noted as such when the Lorentzian case is discussed in unit 9.

## What to carry forward

A connection differentiates sections along vector fields with a Leibniz rule; on $TM$ it may be torsion-free and metric, and exactly one connection is both: the Levi-Civita connection, given by the Koszul formula and, in coordinates, by the Christoffel symbols. The symbols are computable from $g_{ij}$ but are not a tensor. For a submanifold, the Levi-Civita connection is the tangential projection of the ambient one and the normal part is the second fundamental form. Next unit: parallel transport, geodesics and the exponential map.
