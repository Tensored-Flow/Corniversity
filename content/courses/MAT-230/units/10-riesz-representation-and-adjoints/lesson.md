# Riesz representation and adjoints

Finite-dimensional least squares worked because a minimiser existed and its error was orthogonal to the approximation space. Infinite dimensions make existence a theorem. The reward is that every bounded linear measurement becomes an inner product with one vector, and every bounded operator obtains a geometric transpose.

Read MIT 18.102 [Lecture 17](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/c97549663746d6bc4a379077e067c55b_MIT18_102s21_lec17.pdf), minimisers, orthogonal complements and Riesz representation, and [Lecture 18](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/7f23bfc43ee2e1efd238a5384e5b9d51_MIT18_102s21_lec18.pdf), adjoints and the kernel–range relation. Our inner product remains linear in its first argument.

## A minimising sequence really converges

Let $M$ be a nonempty closed subspace of a Hilbert space $H$, and fix $x\in H$. Put $d=\inf_{m\in M}\|x-m\|$ and choose $m_n$ with distances tending to $d$. The parallelogram identity gives
$$\|m_n-m_k\|^2=2\|x-m_n\|^2+2\|x-m_k\|^2-4\left\|x-\frac{m_n+m_k}{2}\right\|^2.$$
The last squared distance is at least $d^2$, so the right side tends to zero. Thus $m_n$ is Cauchy. Completeness gives a limit and closedness places it in $M$. Both hypotheses have now appeared at an identifiable step.

If $m$ minimises, vary it to $m+tv$ for $v\in M$. Minimising the resulting quadratic for real $t$ gives $\operatorname{Re}\langle x-m,v\rangle=0$; replacing $v$ by $iv$ gives the imaginary part too. Therefore $x-m\in M^\perp$. Conversely orthogonality proves minimality and uniqueness by Pythagoras. Write $x=P_Mx+(I-P_M)x$. This decomposition shows $P_M$ is linear, bounded by one, idempotent and self-adjoint.

Closedness is indispensable. In $\ell^2$, finitely supported sequences approximate every vector but need not contain it. A vector with infinitely many nonzero coordinates has distance zero from that subspace and no nearest element there.

## Riesz representation, with conjugates visible

Let $f:H\to\mathbb C$ be bounded and linear. If $f=0$, use the zero vector. Otherwise $M=\ker f$ is closed. Choose $w$ with $f(w)=1$ and put $z=w-P_Mw$. Then $z\perp M$, $z\ne0$, and $f(z)=1$. Since $x-f(x)z\in M$,
$$\langle x,z\rangle=f(x)\|z\|^2.$$
Hence $f(x)=\langle x,v\rangle$ with $v=z/\|z\|^2$. Uniqueness follows by testing the difference of two representers against itself. Cauchy–Schwarz gives $\|f\|\le\|v\|$, and testing $v/\|v\|$ proves equality when $v\ne0$. The correspondence $v\mapsto f_v$ is conjugate-linear with our convention; forgetting this is a common complex-space error.

**Worked example.** In $L^2(0,1)$, $f(u)=\int_0^1 t\,u(t)\,dt$ is represented by $v(t)=t$, with norm $1/\sqrt3$. But point evaluation $u\mapsto u(1/2)$ is not a functional on $L^2$ equivalence classes at all: changing a representative at one point changes that value without changing the class. Even on continuous functions with the $L^2$ norm, narrow spikes show evaluation is unbounded.

## An operator's adjoint

For bounded $A:H\to H$, fix $y$. The function $x\mapsto\langle Ax,y\rangle$ is bounded linear, so Riesz gives a unique vector $A^*y$ satisfying
$$\langle Ax,y\rangle=\langle x,A^*y\rangle.$$
Uniqueness shows $A^*$ is linear in $y$, and the norm estimate gives $\|A^*\|\le\|A\|$. Applying the defining identity twice yields $(A^*)^*=A$ and equality of norms. Also $(AB)^*=B^*A^*$ and $(\lambda A)^*=\overline\lambda A^*$. These are statements about bounded everywhere-defined operators; unbounded differential operators require domains and belong to a later course.

**Worked example.** The right shift $S(x_1,x_2,\ldots)=(0,x_1,x_2,\ldots)$ on $\ell^2$ has adjoint $S^*(y_1,y_2,\ldots)=(y_2,y_3,\ldots)$. Thus $S^*S=I$, while $SS^*$ removes the first coordinate. An isometry need not be onto, and its adjoint need not be its two-sided inverse.

Finally, $y\perp\operatorname{ran}A$ exactly when $\langle Ax,y\rangle=0$ for all $x$, exactly when $A^*y=0$. Therefore
$$\overline{\operatorname{ran}A}=(\ker A^*)^\perp.$$
The closure cannot generally be dropped. Your sheet will exhibit a dense proper range explicitly; this distinction later controls when an operator equation is actually solvable rather than merely approximable.
