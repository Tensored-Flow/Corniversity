# Vector bundles and the tangent bundle

A vector bundle assigns a vector space to each point and makes those spaces vary smoothly. Equal dimensions do not give a preferred identification between different fibres. That missing identification is why vector fields require transition rules and why differentiating a section later needs a connection.

Read MIT 18.965 [Lecture 6, Definition 7.1 and bundle constructions](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture6.pdf), and [Lecture 7, Definition 7.3 and the differential](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture7.pdf). Hitchin §3.2 gives the derivation presentation of tangent vectors. These are three descriptions of one structure, not three different tangent spaces.

## Gluing linear spaces

A smooth rank-$k$ real vector bundle is a smooth map $\pi:E\to M$ with a vector-space structure on each fibre and local diffeomorphisms $\tau_i:E|_{U_i}\to U_i\times\mathbb R^k$ which are linear on fibres. On an overlap,
$$\tau_i\tau_j^{-1}(x,v)=(x,g_{ij}(x)v),\qquad g_{ij}:U_i\cap U_j\to GL(k,\mathbb R).$$
Our convention is that $g_{ij}$ converts **$j$-components into $i$-components**. It forces $g_{ii}=I$, $g_{ji}=g_{ij}^{-1}$ and $g_{ij}g_{jk}=g_{ik}$. The order matters for matrices.

Conversely, smooth maps satisfying these identities glue the disjoint union of the products: identify $(x,v)_j$ with $(x,g_{ij}(x)v)_i$. The cocycle supplies transitivity, and the resulting product charts define the smooth bundle structure. With the usual Hausdorff, second-countable base and a countable trivializing refinement, these charts give a Hausdorff second-countable total space. Separation of points in one fibre is checked in one trivialization; points above different base points are separated downstairs.

A section is a smooth $s:M\to E$ with $\pi s=\operatorname{id}$. Its local coefficient functions satisfy $s_i=g_{ij}s_j$. A global frame is $k$ sections forming a basis in every fibre; it trivializes the bundle by $(x,a)\mapsto\sum a_is_i(x)$. Conversely a trivialization gives a frame. In rank one a nowhere-zero section is precisely a global frame.

## Worked example: a line which comes back reversed

The Möbius line bundle is $(\mathbb R\times\mathbb R)/((t,v)\sim(t+2\pi,-v))$ over $S^1$. A section corresponds to a smooth function $a(t)$ satisfying $a(t+2\pi)=-a(t)$. If it were nowhere zero, $a(0)$ and $a(2\pi)$ would have opposite signs, contradicting the intermediate value theorem. Hence the bundle is not trivial. Nevertheless each short arc admits a product trivialization. Local product structure says nothing about a single global product.

The direct sum of two Möbius bundles is trivial: in the lifted fibre $\mathbb R^2$, the vectors $(\cos(t/2),\sin(t/2))$ and $(-\sin(t/2),\cos(t/2))$ both reverse sign after $2\pi$ and form a basis everywhere. This illustrates why a rank-two sum can remove a rank-one obstruction.

## Tangent vectors without a preferred ambient space

In a chart $x:U\to\mathbb R^n$, a tangent vector at $p$ has components $v\in\mathbb R^n$. In another chart $y$, its components must be $D(y\circ x^{-1})_{x(p)}v$. The chain rule is exactly the cocycle identity, so these Jacobians construct a rank-$n$ bundle $TM$.

The same vector can be represented by a curve $\gamma$ with $\gamma(0)=p$: use $(x\gamma)'(0)$. Every coordinate vector occurs from a coordinate straight line for small time, and the chain rule makes the equivalence of velocities independent of chart. It also acts on a smooth function by
$$v(f)=\left.\frac d{dt}\right|_0 f(\gamma(t))=\sum_i v^i\frac{\partial(f\circ x^{-1})}{\partial x^i}(x(p)).$$
This is linear and obeys $v(fg)=f(p)v(g)+g(p)v(f)$.

Conversely every derivation at $p$ has this form. A derivation annihilates constants. It depends only on the germ of the function: if $f$ vanishes near $p$, choose a bump $b$ equal to one near $p$ and supported where $f=0$; applying the product rule to $bf=0$ gives $v(f)=0$. Locally, write $f(x)-f(0)=\sum x^ih_i(x)$ by integrating derivatives along the segment, with $h_i(0)=\partial_i f(0)$. The product rule now yields $v(f)=\sum v(x^i)\partial_i f(p)$. A smaller coordinate ball justifies the segment formula. Bump functions used here are the local Euclidean ones; their global organisation comes next unit.

## Differentiating maps

For $f:M\to N$, define $(df_pv)(h)=v(h\circ f)$. In charts this is the familiar Jacobian. The chain rule gives $d(g\circ f)=dg\circ df$, and $df$ is a smooth map $TM\to TN$ linear on each fibre, covering $f$. It is not generally a bundle map over the identity: its target fibre sits above $f(p)$.

**Worked example.** A tangent vector to $S^2$ at $p$ is $v\in\mathbb R^3$ with $p\cdot v=0$. For height $h(p)=p_3$, $dh_p(v)=v_3$. At the poles the derivative vanishes; elsewhere a tangent vector with nonzero third component exists, so the derivative is onto. For the antipodal map $a(p)=-p$, $da_p(v)=-v$ belongs to $T_{-p}S^2$, as required.

## New bundles from old

If $E,F$ have transition matrices $g_{ij},h_{ij}$, their Whitney sum has block-diagonal transitions. For $f:N\to M$, the pullback is
$$f^*E=\{(q,e):f(q)=\pi(e)\},$$
with fibre $E_{f(q)}$ and transitions $g_{ij}\circ f$ on the pulled-back cover. Its local product charts prove smoothness directly; no submersion assumption on $f$ is required. The derivative can be viewed as a map $TM\to f^*TN$ over $M$, $v\mapsto(p,df_pv)$.

For the tautological bundle over $\mathrm{Gr}_k(\mathbb R^N)$, the fibre above a plane $L$ is $L$ itself. Near a fixed plane $L_0$, nearby planes are graphs of linear maps $A:L_0\to L_0^\perp$. Projection to $L_0$ trivializes the bundle, with inverse $(A,u)\mapsto(A,u+Au)$. This explicit local inverse is the smoothness check hidden by the attractive set description.

On the sheet, make every base point visible when writing a vector. If two tangent vectors live at different points, adding them requires an additional identification; a local frame can provide one, but a different frame can change it.
