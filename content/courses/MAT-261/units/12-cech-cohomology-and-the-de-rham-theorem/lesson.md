# Čech cohomology, Stokes, and the de Rham theorem

A closed form has local primitives. On an overlap those primitives may disagree, and their disagreement itself satisfies an equation. Čech cohomology records this overlap data. The de Rham theorem says that, over the real numbers, the obstruction measured by differentiation and the obstruction measured by gluing are the same.

Read MIT 18.965 [Lecture 33, refinement and Lemma 27.1](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture33.pdf), and [Lecture 34, §28](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture34.pdf). The integration reference is [Hitchin §§7.1–7.2](https://people.maths.ox.ac.uk/hitchin/files/LectureNotes/Differentiable_manifolds/manifolds2014.pdf#page=57), particularly Theorem 7.6. We supply an explicit double-complex argument and an original sphere computation. MIT Lecture 35 on the classification of immersions is further reading only, not an unannounced prerequisite for this final synthesis.

## Cochains live on intersections

Fix an open cover $\mathcal U=(U_i)$. A degree-$p$ Čech cochain with real constant-sheaf coefficients is an alternating collection of **locally constant** functions $c_{i_0\ldots i_p}$ on $U_{i_0}\cap\cdots\cap U_{i_p}$. A disconnected intersection can have a different constant on each component. Define
$$(\delta c)_{i_0\ldots i_{p+1}}=\sum_{j=0}^{p+1}(-1)^j c_{i_0\ldots\widehat{i_j}\ldots i_{p+1}}\big|_{U_{i_0\ldots i_{p+1}}}.$$
Each term in $\delta^2$ omits two indices and appears twice with opposite signs, so $\delta^2=0$. In degree zero our convention is $(\delta c)_{ij}=c_j-c_i$. Some source displays use the opposite degree-zero sign; choose one convention throughout.

A refinement $V_a\subset U_{r(a)}$ pulls a cochain back by restriction and replacement of indices. Two choices of refinement map induce chain-homotopic maps: insert the two choices in successive positions with alternating signs, and the boundary terms telescope. Hence the induced cohomology map is independent of that choice. Taking the direct limit over refinements defines $\check H^p(M;\mathbb R)$. This refinement step is why an arbitrary single cover cannot automatically be used to calculate the space's cohomology.

**Worked example.** Cover the circle by two proper arcs whose intersection has two components. Then $C^0=\mathbb R^2$ and $C^1=\mathbb R^2$, with $\delta(a,b)=(b-a,b-a)$. Thus $H^0=\mathbb R$ and the quotient in degree one is one-dimensional, detected by the difference of the two overlap constants. Treating the intersection as if connected would incorrectly erase this class.

## Smooth forms can be glued without higher obstruction

Replace locally constant functions by smooth $q$-forms on intersections; write $C^{p,q}=\check C^p(\mathcal U;\Omega^q)$. Choose a locally finite subordinate partition $(\rho_j)$. For $p\ge1$ define
$$(Kc)_{i_0\ldots i_{p-1}}=\sum_j\rho_jc_{j i_0\ldots i_{p-1}}.$$
Each term extends by zero outside $U_j$, using its support condition, and the sum is smooth by local finiteness. Expanding both sides shows
$$\delta K+K\delta=I\qquad\text{in positive Čech degree}.$$
Indeed the terms with an omitted $i$ cancel in pairs, leaving $\sum_j\rho_jc=c$. If $\delta c=0$, then $c=\delta(Kc)$, proving positive-degree Čech cohomology of smooth forms vanishes. At degree zero, compatible local forms glue uniquely to a global form. This is the concrete meaning of acyclicity here; saying “the sheaf is fine” names the partition-of-unity mechanism, not an additional calculation.

**Worked gluing problem.** Suppose smooth functions $a_{ij}$ on double overlaps obey $a_{jk}-a_{ik}+a_{ij}=0$. Set $b_i=\sum_j\rho_j a_{ji}$. Then $b_j-b_i=a_{ij}$, so the discrepancy is removed by changing local data by the $b_i$. Locally constant functions do not admit this argument inside their own sheaf: multiplying by a variable partition function generally destroys local constancy. That is why their cohomology can be nonzero.

## The two directions of the comparison

Use a **good cover**, meaning every nonempty finite intersection is smoothly contractible. Smooth manifolds have cofinal good covers; one construction uses sufficiently small strongly convex neighbourhoods for a Riemannian metric and refinements. We use this standard geometric covering lemma as an explicit input, as Lecture 34 does. For the sphere example below we construct a good cover directly, so that computation has no abstract cover-existence gap.

The double complex $C^{p,q}$ has horizontal differential $\delta$ and vertical differential $d$. They commute because restriction commutes with exterior differentiation. On total degree $p+q$ define
$$D=\delta+(-1)^p d.$$
The sign makes $D^2=0$: the two mixed terms cancel. Each total degree has only finitely many bidegrees, even if the cover itself is infinite.

First compute horizontally. The partition homotopy proves all rows are exact in positive Čech degree; their degree-zero kernels are global forms. A finite staircase elimination makes this precise: in a $D$-closed total cochain, eliminate the component of largest Čech degree by subtracting a $D$-coboundary obtained from its horizontal primitive. Repeat until only Čech degree zero remains. The remaining compatible components are a closed global form. Apply the same elimination to a coboundary to see that two such forms represent the same total class exactly when they differ by a global exact form. Thus total cohomology is $H^*_{\mathrm{dR}}(M)$.

Now compute vertically. On every nonempty intersection the Poincaré/homotopy lemma makes the de Rham complex exact in positive form degree; its degree-zero kernel is the locally constant functions. Eliminate the highest form-degree components, using their local primitives and the signed differential, until only the row $q=0$ remains. Its closedness says the entries are locally constant, and its differential is precisely $\delta$. The same boundary argument gives total cohomology equal to the Čech cohomology of the good cover. Both eliminations terminate in each total degree; they are the elementary content often packaged as a spectral-sequence argument.

Combining the two comparisons and compatible refinements gives
$$H^k_{\mathrm{dR}}(M)\cong\check H^k(M;\mathbb R).$$
This statement concerns real coefficients. It does not recover integer torsion. No orientation is needed for this isomorphism, although orientation is needed for integrating a top-degree form to a signed real number.

## Orientation and Stokes: checking the sign geometrically

An orientation chooses positively oriented tangent bases consistently; equivalently, oriented charts have positive transition determinants. Top forms integrate by oriented charts and a partition of unity, with the change-of-variables theorem ensuring independence of choices. On an oriented manifold with boundary use the **outward normal first** convention: $(\nu,v_1,\ldots,v_{n-1})$ is a positive ambient basis when $(v_1,\ldots,v_{n-1})$ is a positive boundary basis and $\nu$ points outward.

For a compactly supported smooth $(n-1)$-form $\eta$,
$$\int_Md\eta=\int_{\partial M}\eta.$$
One proof partitions the form into coordinate-supported pieces. Interior pieces integrate to zero by the one-variable fundamental theorem; in a boundary half-space only the derivative normal to the boundary contributes, with exactly the outward-first sign. Summing gives Stokes. Compact support removes terms at infinity. On a compact manifold every smooth form already has compact support.

**Worked example.** On the annulus $1\le r\le2$ with orientation $r\,dr\wedge d\theta$, the outer circle is counterclockwise and the inner circle clockwise. For the closed angular form $d\theta$, their integrals are $2\pi$ and $-2\pi$, so the total boundary integral is zero. Counting both boundaries counterclockwise would violate the orientation convention, not Stokes.

## A concrete sphere and its nonzero top class

Choose four unit vectors $v_0,\ldots,v_3$ pointing to the vertices of a regular tetrahedron centred at zero, so $\sum v_i=0$ and $v_i\cdot v_j=-1/3$ for $i\ne j$. Let $U_i=\{p\in S^2:p\cdot v_i>0\}$. They cover: if all dot products were nonpositive, their sum zero would force all zero, impossible because the vectors span $\mathbb R^3$. Each proper nonempty intersection is a geodesically convex spherical region and contracts smoothly by normalised straight interpolation to an interior point. Every triple intersection is nonempty, containing $-v_l$ for the omitted index $l$, while the fourfold intersection is empty.

Its Čech complex is therefore $\mathbb R^4\to\mathbb R^6\to\mathbb R^4$, with no higher terms. The first map has rank three; the second has rank three as well. The sheet proves these ranks explicitly. Hence the real cohomology of $S^2$ is $\mathbb R$ in degrees zero and two and zero in degree one.

The two-form
$$\Omega=(x\,dy\wedge dz+y\,dz\wedge dx+z\,dx\wedge dy)|_{S^2}$$
is the outward-oriented area form. Spherical coordinates give integral $4\pi$. It is closed because the sphere has no three-forms. If it were exact, Stokes on the closed sphere would make its integral zero. Thus $[\Omega/(4\pi)]$ is a nonzero generator, and integration identifies $H^2_{\mathrm{dR}}(S^2)$ with $\mathbb R$.

Your capstone now links the whole course: use charts and partitions to organise local data, the Poincaré lemma to find primitives, the Čech differential to track their disagreement, and Stokes to detect a class which cannot disappear globally. Present the proof as connected reasoning, with the good-cover lemma and any other imported result clearly named. A successful solution is evidence of those demonstrated arguments, not a substitute for further mathematical study or external assessment.
