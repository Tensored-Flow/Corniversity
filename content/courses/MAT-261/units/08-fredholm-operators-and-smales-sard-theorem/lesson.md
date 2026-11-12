# Fredholm operators and Sard–Smale

An infinite-dimensional problem can still have only finitely many degrees of freedom and finitely many obstructions. Fredholm theory isolates this situation. Its index measures the difference between those two finite numbers; it does not subtract the dimensions of two infinite-dimensional spaces.

Read MIT 18.965 [Lecture 15](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture15.pdf), [Lectures 16–17, Definition 16.13 and Lemmas 16.18–20](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture16_17.pdf), and [Lectures 18–19, Lemma 17.4 and Theorem 17.3](https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/lecture18_19.pdf). The printed Theorem 17.3 omits the Fredholm hypothesis used throughout its proof; include it. Several source statements suppress Banach-space hypotheses. The versions below retain them.

## The analytic toolkit, with its domains

A Banach space is a complete normed vector space. For a **linear** map, continuity is equivalent to boundedness $\|Tx\|\le C\|x\|$. The space $B(X,Y)$ of bounded linear maps is complete when $Y$ is Banach; it is a Banach algebra under composition when $X=Y$ is Banach, not for arbitrary different domain and codomain.

The open mapping theorem applies to bounded surjective maps between Banach spaces. Its bijective case gives a bounded inverse. The closed graph theorem also requires both spaces Banach and an everywhere-defined linear operator. Hahn–Banach supplies continuous extensions of scalar functionals and implies a finite-dimensional subspace has a closed complement: extend its coordinate functionals and take the common kernel. These tools were proved in MAT-230; here their proofs are an explicitly assigned dependency, rather than a new inference from the geometry notation.

**Worked compactness example.** On a compact interval, the unit ball for the $C^1$ norm is uniformly bounded and equicontinuous, since $|f(x)-f(y)|\le\|f'\|_\infty|x-y|$. Arzelà–Ascoli gives relative compactness in $C^0$. Its proof takes a subsequence converging on a countable dense set, then uses equicontinuity and a finite net to make that subsequence uniformly Cauchy. Completeness of $C^0$ supplies the limit. Thus the inclusion $C^1\to C^0$ is compact, although the identity on an infinite-dimensional normed space is not.

## Fredholm means kernel, closed range, and cokernel

A bounded map $T:X\to Y$ between Banach spaces is Fredholm if its kernel is finite-dimensional, its range is closed, and $Y/\operatorname{ran}T$ is finite-dimensional. Define
$$\operatorname{ind}T=\dim\ker T-\dim(Y/\operatorname{ran}T).$$
Closedness is part of the definition used in this course. It makes the quotient a Banach space and lets us use the bounded inverse theorem on a complement of the kernel.

**Worked example.** On $\ell^2(\mathbb N)$, the right shift $S(x_1,x_2,\ldots)=(0,x_1,x_2,\ldots)$ has zero kernel and a closed range of codimension one, hence index $-1$. The left shift has index $1$. By contrast $D(x_n)=(x_n/n)$ has zero kernel and dense nonclosed range: finite sequences are in its range, while $(1/n)$ is not. It is compact but not Fredholm. Compactness and Fredholmness are different properties.

Choose closed splittings $X=X_0\oplus K$ and $Y=R\oplus C$, where $K=\ker T$, $R=\operatorname{ran}T$, and $C$ is finite-dimensional. Then $T$ has block matrix $\begin{pmatrix}A&0\\0&0\end{pmatrix}$ with $A:X_0\to R$ invertible. A small perturbation has matrix
$$\begin{pmatrix}A+a&b\\c&d\end{pmatrix}.$$
For sufficiently small operator norm, $A+a$ remains invertible by its Neumann series, whose first term is the identity. Invertible block row and column operations reduce this to
$$\begin{pmatrix}A+a&0\\0&d-c(A+a)^{-1}b\end{pmatrix}.$$
The lower block is a map between the fixed finite-dimensional spaces $K$ and $C$. Its kernel-minus-cokernel dimension is always $\dim K-\dim C$. Consequently the Fredholm operators are open and their index is locally constant, even though kernel and cokernel dimensions can jump separately.

## Inverting up to a compact error

A Fredholm operator has a bounded parametrix $R_0:Y\to X$: invert $A$ on the range and set it zero on $C$. Then $R_0T-I$ and $TR_0-I$ are finite-rank and therefore compact. Conversely the existence of a bounded two-sided inverse modulo compact operators implies Fredholmness (Theorem 16.26, with “finite-dimensional cokernel” in the converse, not the source's accidental “finite-dimensional range”). Here is the mechanism.

If $R_0T=I+K$, compactness forces $\ker T$ finite-dimensional: on that kernel $I=-K$, so its closed unit ball is compact. Choose a closed complement $X_0$. If no estimate $\|x\|\le C\|Tx\|$ held on $X_0$, there would be unit $x_j\in X_0$ with $Tx_j\to0$. Compactness of $K$ and $x_j=R_0Tx_j-Kx_j$ give a convergent subsequence, with norm-one limit in $X_0\cap\ker T$, a contradiction. The estimate gives closed range. Applying the same kernel argument to $R_0^*T^*=I+K'^*$, obtained from $TR_0=I+K'$, makes $\ker T^*$ finite-dimensional; the dual of the closed-range quotient is $\ker T^*$, so the cokernel is finite-dimensional.

The compact-adjoint fact used here has a short proof: bounded functionals restricted to the compact closure of $K(B_X)$ are uniformly bounded and equicontinuous. Arzelà–Ascoli produces a uniformly convergent subsequence of restrictions, which is exactly norm convergence of their images under $K^*$. This avoids assuming every Banach-space compact operator is a norm limit of finite-rank operators, an assertion that is not valid without additional approximation hypotheses. It *is* valid for Hilbert spaces, as studied in MAT-230.

In particular $I+K$ is Fredholm for compact $K$. The path $I+tK$ stays Fredholm for $0\le t\le1$, so local constancy and connectedness give index zero. More generally compact perturbations preserve the index, using a parametrix and the same path argument.

## A nonlinear map with only finite-dimensional difficulties

A Banach manifold has charts in Banach spaces with smooth transition maps; derivatives are Fréchet derivatives. A smooth map is Fredholm when every derivative is Fredholm. Near a point choose the preceding splittings, with finite-dimensional $K,C$, and write
$$f(x,k)=(a(x,k),b(x,k)).$$
The inverse theorem applied to $(x,k)\mapsto(a(x,k),k)$ gives local coordinates in which
$$f(x,k)=(x,g(x,k)).$$
All failures of surjectivity are now failures of $D_kg:K\to C$. This is a finite-dimensional problem with an infinite-dimensional parameter $x$. The index is locally $\dim K-\dim C$. A regular fibre is a finite-dimensional submanifold of that dimension by the split implicit theorem. A negative-index Fredholm map can have regular values only with empty fibres.

**Sard–Smale, smooth version.** For a smooth Fredholm map between second-countable Banach manifolds, the regular values form a residual set. We use “residual” to mean a set containing a countable intersection of open dense sets. Banach manifolds are Baire, so this gives density; an arbitrary metric space need not be Baire. It is not an assertion of Lebesgue measure one in infinite dimensions.

To understand the proof, work in the normal form on a sufficiently small closed product, with its finite-dimensional $K$ factor compact. Critical images are closed there: a convergent sequence of outputs fixes the convergent Banach-coordinate sequence, and compactness supplies a convergent subsequence of the $K$ coordinates. On each fixed Banach slice, ordinary Sard gives dense regular values in $C$, so this closed critical image has empty interior. Shrink charts so these conclusions remain inside the target chart, cover the domain by countably many such pieces, and take the complement of the union of their nowhere-dense critical images. The source's local-closedness proof needs precisely this bounded finite-dimensional restriction. This argument explains both the finite-dimensional reduction and the global countability requirement.
