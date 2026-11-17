# Partitions of unity, universal bundles, and embedding

A chart solves a problem on one open set. A partition of unity lets us combine local solutions when the equations we want to preserve are linear or affine. It cannot combine arbitrary objects by averaging: averaging two invertible matrices may produce a singular one, for instance. The useful question is which structure survives a weighted sum.

Read MIT 18.965 [Lecture 8, connections, partitions, and Theorem 10.1](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture8.pdf), and [Lecture 9, Theorem 11.1](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture9.pdf). The proof of existence of smooth partitions is supplied in Hitchin §10.4. Below we explain its local construction and use it in three different global arguments.

## Why infinite sums can still be smooth

For an open cover $(U_i)$, a subordinate smooth partition consists of nonnegative smooth functions $\rho_i$ with $\operatorname{supp}\rho_i\subset U_i$, locally finite supports, and $\sum_i\rho_i=1$. Local finiteness means every point has a neighbourhood on which only finitely many terms are nonzero. This makes every derivative of the sum a finite sum near that point; pointwise finiteness alone is weaker and does not supply this justification.

A Hausdorff second-countable finite-dimensional manifold is paracompact. One construction starts with a countable exhaustion by relatively compact open sets and refines an arbitrary cover into coordinate balls whose closures lie in a member of the cover; arrange the balls in compact annular layers to make the refinement locally finite. Shrink to smaller balls still covering the manifold. Euclidean bump functions supported in the larger balls and positive on the smaller balls extend by zero to smooth global functions $b_j$. The locally finite sum $b=\sum_jb_j$ is positive, so $b_j/b$ is a partition for the refinement. Group terms whose balls belong to the same original cover member to obtain a subordinate partition there. The refinement theorem is a topological lemma used here; its full construction is the assigned appendix reading, not a consequence of dividing any arbitrary collection of bumps.

On a compact manifold choose a finite chart cover and its finite partition. This extra finiteness is what makes the Euclidean target in the embedding construction finite-dimensional. On a noncompact manifold the same naïve construction may have infinitely many coordinate blocks and does not by itself prove the finite-dimensional Whitney theorem.

## Worked construction: metrics and connections

Let $E\to M$ be a real vector bundle. A trivialization gives a Euclidean inner product $h_i$ on each fibre over $U_i$. Then $h=\sum_i\rho_i h_i$ is a smooth inner product: at a nonzero vector, every summand is nonnegative and one with positive weight is strictly positive. This proves existence of a bundle metric without assuming the bundle is trivial. For $E=TM$ it gives a Riemannian metric.

A connection differentiates sections: $\nabla_Xs$ is real-bilinear, is $C^\infty$-linear in $X$, and satisfies $\nabla_X(fs)=X(f)s+f\nabla_Xs$. In a local frame one can use ordinary coefficient differentiation as a local connection. Set $\nabla=\sum_i\rho_i\nabla^{(i)}$. The support and local finiteness conditions make the sum globally meaningful. Its product rule contains $(\sum\rho_i)X(f)s=X(f)s$, so it is again a connection. The space of connections is affine; subtracting two cancels the derivative term and leaves a tensorial operation, a one-form with values in $\operatorname{End}E$.

**Worked example.** In a line bundle frame $e$, write $\nabla e=A\otimes e$ for a one-form $A$. In the frame $e'=g e$, with nowhere-zero scalar $g$, the product rule gives $A'=A+g^{-1}dg$. Thus “differentiate coefficients in every frame” is inconsistent: zero connection form in one frame generally becomes nonzero in another. A partition glues the actual connection operators, with their change-of-frame rules, not unrelated arrays of coefficients.

## A bundle as a moving plane

Suppose $E$ has rank $k$ and a finite trivializing cover $U_1,\ldots,U_m$; compact base is a sufficient condition. Let $\phi_i(e)$ be the fibre coordinates and choose a subordinate partition. Define
$$J:E\longrightarrow\mathbb R^{mk},\qquad J(e)=(\rho_1(\pi e)\phi_1(e),\ldots,\rho_m(\pi e)\phi_m(e)),$$
with a zero block outside each chart. The support condition makes extension by zero smooth. On each fibre $J_x$ is injective: at least one weight is positive, and that block is an invertible coordinate map times a nonzero scalar.

Therefore $f(x)=J_x(E_x)$ is a $k$-plane. To check smoothness rather than just declare it, near $x_0$ choose a block which remains invertible. Use that block as coordinates on the plane; the remaining blocks are smooth matrices times its smooth inverse. This is a Grassmannian graph chart. The map
$$e\longmapsto(\pi e,J(e))$$
is now a fibrewise isomorphism $E\cong f^*\gamma_k$. Its inverse in the chosen block is smooth. This proves the universal-bundle claim for finite-type bundles; it does not establish uniqueness of $f$, nor the full homotopy classification of bundles.

## From local coordinates to a global embedding

Let $M$ be a compact $n$-manifold, with finite coordinate cover $(U_i,x_i)$ and subordinate partition $(\rho_i)$. Define
$$F(p)=(\rho_1(p)x_1(p),\ldots,\rho_m(p)x_m(p),\rho_1(p),\ldots,\rho_m(p))\in\mathbb R^{m(n+1)}.$$
Each coordinate product extends smoothly by zero. If $F(p)=F(q)$, choose $i$ with $\rho_i(p)>0$. The scalar coordinates give equal positive weights, and then the vector block gives $x_i(p)=x_i(q)$; hence $p=q$. Omitting the scalar coordinates would make this argument invalid.

If $dF_p(v)=0$, the scalar coordinates give $d\rho_i(v)=0$. In a block with $\rho_i(p)>0$, the product rule then gives $\rho_i(p)dx_i(v)=0$, so $v=0$. Thus $F$ is an injective immersion. Finally, a continuous bijection from compact $M$ onto a subspace of the Hausdorff target is a homeomorphism: images of closed sets are compact and hence closed. Therefore $F$ is an embedding. This final topology step is a distinct obligation, not part of the rank computation.

The construction supplies some finite dimension, not the sharp bound $2n$. Later projection arguments use Sard and transversality to lower it. Here the payoff is conceptual: local coordinates, weights recording where those coordinates are valid, and compactness together produce one faithful global picture.
