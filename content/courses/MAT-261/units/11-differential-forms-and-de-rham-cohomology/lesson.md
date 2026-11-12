# Differential forms, Poincaré lemma, and de Rham cohomology

Differential forms encode quantities we can pull back along maps and integrate over oriented geometric objects. Their alternating algebra is precisely what cancels the unwanted second-derivative terms under a coordinate change. That cancellation produces an intrinsic derivative without choosing a connection.

Read MIT 18.965 [Lecture 31, §25 and Theorem 25.1](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture31.pdf), and [Lecture 32, §25.2 and the beginning of §26](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture32.pdf). The source stops before completing its homotopy-operator construction; we supply it below. Hitchin §§5–6.6 is the optional fuller algebraic presentation identified in the reading list.

## Alternation and the right variance

For a finite-dimensional vector space $V$, a $k$-covector is an alternating $k$-linear map $V^k\to\mathbb R$, an element of $\Lambda^kV^*$. For a dual basis $(e^i)$, the increasing products $e^{i_1}\wedge\cdots\wedge e^{i_k}$ form a basis, so $\dim\Lambda^kV^*=\binom nk$. The whole exterior algebra has dimension $2^n$. Swapping a degree-$p$ form past a degree-$q$ form contributes $(-1)^{pq}$; a one-form wedges with itself to zero, whereas an even-degree form need not.

A smooth $k$-form is a section of $\Lambda^kT^*M$. For $F:M\to N$, define
$$(F^*\omega)_p(v_1,\ldots,v_k)=\omega_{F(p)}(dF_pv_1,\ldots,dF_pv_k).$$
This requires no inverse to $dF$, so pullback is defined for every smooth map, including maps between different dimensions. It preserves wedge products and reverses composition: $(GF)^*=F^*G^*$.

**Worked example.** Under polar coordinates $F(r,\theta)=(r\cos\theta,r\sin\theta)$,
$$F^*dx=\cos\theta\,dr-r\sin\theta\,d\theta,\quad F^*dy=\sin\theta\,dr+r\cos\theta\,d\theta.$$
Expanding the wedge gives $F^*(dx\wedge dy)=r\,dr\wedge d\theta$. The area factor is the determinant, and its sign records orientation. This formula holds on polar coordinate patches with $r>0$; there is no single-valued global angle on the punctured plane.

## Exterior differentiation

Write $\omega=\sum_I a_I\,dx^{i_1}\wedge\cdots\wedge dx^{i_k}$ in a chart. Define
$$d\omega=\sum_I da_I\wedge dx^{i_1}\wedge\cdots\wedge dx^{i_k}.$$
The product rule is $d(\alpha\wedge\beta)=d\alpha\wedge\beta+(-1)^{\deg\alpha}\alpha\wedge d\beta$. For a function, $d^2f=\sum_{i,j}\partial_i\partial_jf\,dx^i\wedge dx^j=0$ because coefficients are symmetric and the wedge is antisymmetric. The product rule then gives $d^2=0$ on every form.

The coordinate expression is invariant: under substitution $dy^i=\sum_j(\partial_jy^i)dx^j$, the chain rule handles derivatives of the coefficient functions, while the remaining second derivatives of $y^i$ cancel by symmetry. Equivalently check $dF^*=F^*d$ on functions and coordinate one-forms, then extend by the product rule and linearity. This proves naturality at the same time as well-definedness.

**Worked example.** For $\eta=x^2dy+yz\,dx$, we have
$$d\eta=2x\,dx\wedge dy+(z\,dy+y\,dz)\wedge dx=(2x-z)dx\wedge dy-y\,dx\wedge dz.$$
Differentiating again gives cancellation of the two $dx\wedge dy\wedge dz$ terms. Computing $d^2\eta$ directly is a useful sign check, not an alternative to the general proof.

## Cohomology measures the failure of a global primitive

A form is closed when $d\omega=0$ and exact when $\omega=d\eta$. Since $d^2=0$, exact forms are closed. Define
$$H^k_{\mathrm{dR}}(M)=\frac{\ker(d:\Omega^k\to\Omega^{k+1})}{d\Omega^{k-1}},$$
with the denominator zero in degree zero. Thus $H^0$ consists of locally constant functions; for a connected manifold it is $\mathbb R$. Pullback induces maps on cohomology because it commutes with $d$.

For a vector field $X$, contraction is $(\iota_X\omega)(v_1,\ldots,v_{k-1})=\omega(X,v_1,\ldots,v_{k-1})$. It obeys the graded product rule. Cartan's identity
$$\mathcal L_X\omega=d\iota_X\omega+\iota_Xd\omega$$
can be checked on functions and $dx^i$, then on their products: both sides are degree-zero derivations. On a function it reduces to $Xf=\iota_Xdf$. This connects the flow viewpoint of the previous unit with the new complex.

## The homotopy operator, including its sign

Let $H:[0,1]\times M\to N$ be a smooth homotopy. Uniquely decompose
$$H^*\omega=\alpha(t)+dt\wedge\beta(t),$$
where $\alpha(t)$ is a $k$-form on $M$ and $\beta(t)$ is a $(k-1)$-form. Define $K\omega=\int_0^1\beta(t)\,dt$ (and $K=0$ on zero-forms). Direct differentiation gives
$$d_{[0,1]\times M}H^*\omega=d_M\alpha+dt\wedge(\partial_t\alpha-d_M\beta).$$
Integrating its $dt$ component yields
$$H_1^*\omega-H_0^*\omega=d_MK\omega+K(d_N\omega).$$
Thus homotopic maps induce the same map on de Rham cohomology. This is an identity of operators on forms before passing to equivalence classes, so it also supplies explicit primitives.

For a star-shaped open $U\subset\mathbb R^n$ with centre zero, use $H(t,x)=tx$. If $\omega$ is closed of degree $k>0$, the constant map at zero pulls it back to zero and the identity gives $\omega=dK\omega$. Explicitly,
$$(K\omega)_x(v_1,\ldots,v_{k-1})=\int_0^1t^{k-1}\omega_{tx}(x,v_1,\ldots,v_{k-1})\,dt.$$
This proves the **Poincaré lemma**. For degree zero, the conclusion is instead that a function with zero differential is constant on a connected domain. A smoothly contractible manifold has the same cohomology as a point, by the same homotopy identity; no orientation is required.

## A closed form with no global angle

On $\mathbb R^2\setminus\{0\}$, put
$$\omega=\frac{-y\,dx+x\,dy}{x^2+y^2}.$$
Polar pullback gives $d\theta$, so it is closed and locally exact. Around the unit circle its integral is $2\pi$. An exact one-form integrates to zero on a closed curve by the one-variable fundamental theorem applied to its potential, so no global potential exists. The puncture is the obstruction, not a failure of local differentiation.

The final exercise proves more: every closed one-form on the punctured plane differs from a scalar multiple of $\omega$ by an exact form. Its period around one positively oriented circle is the scalar invariant. The next unit replaces local primitives and their differences by a systematic Čech complex. On overlaps, two primitives differ by locally constant functions; those differences are the first appearance of the local-to-global comparison.

## Assessed proof work

Exercise 5 is the explicit proof portfolio for this unit: derive the homotopy identity, including its sign and degree-zero case, then prove Poincaré and distinguish its column-exactness role from partition-of-unity row exactness. The punctured-plane application in exercise 4 is complementary evidence, not a substitute for that derivation.
