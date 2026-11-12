# Lie derivative, Frobenius, and foliations

A vector field prescribes one direction of motion. A distribution prescribes several allowed directions at each point. The question is whether those directions form the tangent spaces of actual submanifolds. Frobenius' theorem answers it through brackets: infinitesimal motion in two allowed directions must not create a new forbidden direction.

Read MIT 18.965 [Lecture 29, §21.1](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture29.pdf) and [Lecture 30, §§21.2–24](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture30.pdf). Hitchin §4.3 supplies a second presentation of flows. We prove the local normal forms below. Holonomy and the Reeb theorems then show why a local product description does not settle the global geometry.

## Compare vectors at the same point

Let $\Phi_t$ be the local flow of $X$. A vector field $Y$ evaluated at $\Phi_t(p)$ lies in a different tangent space from $Y(p)$. Pull it back before differentiating:
$$\mathcal L_XY(p)=\left.\frac d{dt}\right|_0 d\Phi_{-t}|_{\Phi_t(p)}Y(\Phi_t(p)).$$
With this convention $\mathcal L_XY=[X,Y]$, where $[X,Y]f=X(Yf)-Y(Xf)$. Expanding in coordinates, the second derivatives of $f$ cancel and
$$[X,Y]^j=\sum_i\left(X^i\partial_iY^j-Y^i\partial_iX^j\right).$$
This is a vector field, independent of coordinates because the derivation definition is intrinsic. The bracket is real-bilinear, antisymmetric and satisfies the Jacobi identity; it is not $C^\infty$-bilinear. For example $[fX,Y]=f[X,Y]-Y(f)X$.

**Worked example.** For $X=\partial_x$ and $Y=x\partial_y$ on the plane, $[X,Y]=\partial_y$. The flow of $X$ translates $x$, so pulling $Y$ back replaces its coefficient $x$ by $x+t$, whose derivative is one. If the push/pull direction were reversed, a sign would change; the convention must be stated before comparing formulas.

## Straightening one field

If $X(p)\ne0$, choose a small hypersurface $S$ through $p$ transverse to $X$. The map $(t,q)\mapsto\Phi_t(q)$ has invertible derivative at $(0,p)$: the time direction maps to $X(p)$ and the other directions span $T_pS$. The inverse theorem gives coordinates in which $X=\partial_t$. This is the flow-box theorem. It only uses small times; a vector field need not have a global flow on a noncompact manifold.

A rank-$r$ smooth distribution is a rank-$r$ vector subbundle $D\subset TM$. It is **involutive** if brackets of its smooth local sections remain sections of $D$. It is **integrable** if near each point there are coordinates $(x^1,\ldots,x^r,y^1,\ldots,y^{n-r})$ in which it is spanned by the $x$-coordinate fields. Constant rank is part of this theorem; a family whose rank jumps requires a different theory.

## Frobenius with the key commutation step visible

Integrability implies involutivity by the coordinate bracket formula. For the converse, choose coordinates so projection of $D_p$ to the first $r$ coordinate directions is an isomorphism. This remains true nearby. There is then a unique local frame
$$X_i=\partial_{x^i}+\sum_\alpha a_i^\alpha(x,y)\partial_{y^\alpha},\qquad1\le i\le r.$$
Every bracket $[X_i,X_j]$ has zero horizontal components. Involutivity says it belongs to $D$, and the only vector in $D$ with all horizontal components zero is zero. Hence these particular frame fields commute.

Commuting fields have commuting local flows. One justification differentiates the pullback of $X_j$ along the flow of $X_i$: its derivative is the pulled-back bracket, hence zero; uniqueness of ODE solutions then gives commuting flows. Let $S$ be the coordinate slice $x=0$ and define
$$\Psi(t_1,\ldots,t_r,y)=\Phi^{X_1}_{t_1}\cdots\Phi^{X_r}_{t_r}(0,y).$$
At the central point its derivative is invertible. In its local inverse coordinates, commutation implies $\Psi_*\partial_{t_i}=X_i$, so $D$ is the span of the first $r$ coordinate directions. These are the desired foliation charts. This proof explains why an arbitrary frame need not commute although an adapted frame can be chosen to do so.

**Worked example.** On $\mathbb R^3$, $X=\partial_x+y\partial_z$ and $Y=\partial_y$ span a rank-two distribution but $[X,Y]=-\partial_z$, which is outside their span at every point. No local surface can have exactly these tangent planes. By contrast the kernel of $d(z/(1+x^2+y^2))$ is integrable, with leaves $z=c(1+x^2+y^2)$; the denominator ensures this differential has a nonzero $z$ component everywhere.

## Leaves need their own topology

Patching compatible local integral pieces produces maximal connected immersed leaves, giving a foliation. A leaf need not be an embedded submanifold with the subset topology. On $T^2=\mathbb R^2/\mathbb Z^2$, the constant vector field $(1,\alpha)$ has circular leaves when $\alpha$ is rational and injectively immersed dense lines when $\alpha$ is irrational. Injectivity in the irrational case follows because $(t,\alpha t)\in\mathbb Z^2$ forces $t=0$. Density follows from density of irrational rotations on the circle: the closure of the subgroup generated by $\alpha\bmod1$ is a closed subgroup, and a proper closed subgroup of the circle is finite (arbitrarily small positive elements otherwise generate arbitrarily fine meshes). Irrationality excludes the finite case.

The line's intrinsic topology and the topology induced from its dense image differ. Its leaf space is correspondingly badly behaved; the quotient by all these dense leaves is not a Hausdorff manifold. Frobenius never promised a well-behaved global quotient.

## Codimension one and holonomy

Locally a codimension-one distribution is $D=\ker\eta$ for a nowhere-zero one-form. For $X,Y\in D$,
$$d\eta(X,Y)=-\eta([X,Y]).$$
Thus involutivity is equivalent to $\eta\wedge d\eta=0$. In dimension three, writing $\eta=n_1dx+n_2dy+n_3dz$ turns this into $n\cdot(\nabla\times n)=0$. Multiplying $\eta$ by a nowhere-zero function preserves the zero condition, as a defining covector should. The exterior derivative notation is developed fully in the next unit; here the formula can also be verified by direct partial differentiation.

Holonomy records the change in a small transversal after following a loop in a leaf through a sequence of foliation charts. Only the germ near the base point is intrinsic, and changing the transversal conjugates that germ. In the suspension quotient
$$(t+1,y)\sim(t,\lambda y),\qquad\lambda>0,$$
the horizontal distribution descends. The leaf $y=0$ is a circle; following it once carries a transversal coordinate $y$ to $\lambda y$. For $\lambda\ne1$ this holonomy is nontrivial, even though every point has a local product chart.

## What Reeb stability adds

Local Reeb stability is an additional theorem: a compact leaf with finite holonomy has a saturated neighbourhood described by its finite holonomy cover and transverse holonomy action. With trivial holonomy this is a product foliated neighbourhood. Compactness lets finitely many charts control continuation around the whole leaf; finite holonomy prevents infinitely many incompatible returns. The source's Lemma 24.4 gives the simply connected compact-leaf case needed below. Its proof is assigned reading; it is not a consequence of Frobenius alone.

The global three-dimensional result in source Theorem 24.2 says: for a **connected closed oriented three-manifold** with a smooth transversely oriented codimension-one foliation, the presence of a leaf diffeomorphic to $S^2$ forces the foliated manifold to be a product $S^2\times S^1$ with sphere leaves. Here “closed” means compact without boundary, and transverse orientation orients the normal line bundle. The source sketch propagates the local sphere product using a transverse flow and compactness. The global continuation and product conclusion are advanced inputs in this unit; we assess the correct hypotheses and their contrast with the suspension example, not a claim that a few local charts prove the global theorem. A torus leaf or an infinite-holonomy compact leaf does not satisfy that sphere/finite-holonomy premise.
