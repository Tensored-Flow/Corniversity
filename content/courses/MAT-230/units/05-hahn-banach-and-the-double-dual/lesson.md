# Hahn–Banach and the double dual

Why should a space have enough continuous linear measurements to distinguish its points? An algebraic basis produces linear functionals, but generally gives no control of their size. Hahn–Banach supplies that control. It is a theorem about extending a measurement without making it less stable.

Read MIT 18.102, [Lecture 5](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/06f9cf855f9f5eaa1898f3e684e05cec_MIT18_102s21_lec5.pdf), Theorem 48 and Lemma 49, then [Lecture 6](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/806234baa2feadee4b54cdf679382257_MIT18_102s21_lec6.pdf), Theorems 50 and 54. The proof below is an original reconstruction; its real-to-complex step makes explicit a step compressed in the notes.

## Extending one dimension

Let $X$ be a real normed space, $M$ a linear subspace, and $f:M\to\mathbb R$ linear with $|f(m)|\le C\|m\|$. Neither completeness of $X$ nor closedness of $M$ is needed. Choose $x_0\notin M$. Every vector of $M+\mathbb Rx_0$ has a unique expression $m+tx_0$, so any extension has the form $F(m+tx_0)=f(m)+ta$. The issue is choosing the scalar $a$.

For the bound $F(v)\le C\|v\|$, the cases $t>0$ and $t<0$, after division and rescaling, require
$$\sup_{m\in M}\{f(m)-C\|m-x_0\|\}\le a\le\inf_{n\in M}\{C\|n+x_0\|-f(n)\}.$$
This interval is nonempty: linearity and the triangle inequality give
$$f(m)+f(n)=f(m+n)\le C\|m+n\|\le C\|m-x_0\|+C\|n+x_0\|.$$
Choosing $m=n=0$ on the opposite side also shows the endpoints are finite. Applying the upper bound to $-v$ gives the lower bound, hence $|F(v)|\le C\|v\|$.

Now order all bounded extensions by extension of domain and values. A chain has an upper bound obtained by taking the union of its domains and its compatible functions: any finitely many vectors lie in one member of the chain. Thus the union is a linear subspace and the same bound survives. Zorn gives a maximal extension; if its domain misses a vector, the lemma extends it further, a contradiction. This proves the real theorem. The chain argument is the logical work: an arbitrary union of unrelated subspaces would not suffice.

For a complex space, apply the real theorem to $\operatorname{Re}f$ on the underlying real space, obtaining $g$. Set $F(x)=g(x)-ig(ix)$. Check $F(ix)=iF(x)$ and that $F$ extends $f$. To prove the sharp bound, choose $|\lambda|=1$ with $\lambda F(x)=|F(x)|$. Then
$$|F(x)|=\operatorname{Re}F(\lambda x)=g(\lambda x)\le C\|x\|.$$
Bounding real and imaginary parts separately would give an unnecessarily larger constant; the phase rotation is essential.

## Worked example: measuring a vector exactly

For $x\ne0$, define $f(\alpha x)=\alpha\|x\|$ on its one-dimensional span. It has norm one. Extend it to $\varphi\in X^*$ without increasing its norm. Then $\varphi(x)=\|x\|$ and $\|\varphi\|=1$. Consequently
$$\|x\|=\sup_{\|\varphi\|\le1}|\varphi(x)|.$$
The upper bound is the definition of operator norm; the extension theorem supplies the reverse inequality. This also proves continuous linear functionals separate distinct points, by applying the argument to their difference.

Define $J:X\to X^{**}$ by $(Jx)(\varphi)=\varphi(x)$. Evaluation is linear in $\varphi$ and bounded by $\|x\|\|\varphi\|$. The displayed supremum says $\|Jx\|=\|x\|$. Thus $J$ preserves all norm distances and is injective. If $X$ is complete its image is closed; this does not make it the whole double dual.

## Worked example: an embedding that is not onto

For $c_0$, the sequences tending to zero with sup norm, every $a\in\ell^1$ defines $\varphi_a(x)=\sum a_nx_n$, with norm $\|a\|_1$. Conversely, testing a bounded functional on finitely supported sign choices shows $(\varphi(e_n))\in\ell^1$; density of finitely supported sequences in $c_0$ gives the representation. Hence $c_0^*=\ell^1$ and $c_0^{**}=\ell^\infty$. Under these identifications $J$ is ordinary inclusion. The constant sequence $(1,1,\ldots)$ is not in its image. A Banach space is **reflexive** precisely when its canonical $J$ is onto, not when some unrelated abstract isomorphism has been exhibited.

## Work to do

Reconstruct the extension interval without memorising its signs. Explain why completeness was absent from Hahn–Banach but enters the closed-image conclusion. The sheet asks you to pass from separating a point from zero to separating a point from a closed subspace, then to examine uniqueness. After a gap, recover the formula for $J$ and prove its isometry in both directions without notes.

## Assessed proof work

The assessed proof portfolio is exercise 4: reproduce the real extension interval and Zorn argument, then the complexification and sharp norm estimate. The application problems remain separate evidence of using the theorem.
