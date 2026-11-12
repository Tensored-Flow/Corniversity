# Hilbert spaces, orthonormal bases and Fourier series

A Banach norm tells us distance. An inner product additionally tells us angle, so approximation can be organised by orthogonality. Throughout this course $\langle x,y\rangle$ is linear in the **first** argument and conjugate-linear in the second. A Hilbert space is complete for $\|x\|=\sqrt{\langle x,x\rangle}$; completeness is what makes infinite orthogonal expansions converge inside the space.

Read MIT 18.102 Lectures [14](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/721d74b7fa9b3b5427779b6905df95ec_MIT18_102s21_lec14.pdf), [15](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/859833f65ee4aec6b0fea35a300d10cd_MIT18_102s21_lec15.pdf), and [16](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/eb44436072623f60f8f416875d4b2c11_MIT18_102s21_lec16.pdf). In particular, reconstruct the source's Fejér-kernel estimate: it supplies completeness of the trigonometric system, which orthogonality alone cannot establish.

## Geometry becomes an estimate

Expanding $\|x-ty\|^2$ and choosing $t=\langle x,y\rangle/\|y\|^2$ proves Cauchy–Schwarz when $y\ne0$; the zero case is immediate. Expanding $\|x+y\|^2+\|x-y\|^2$ gives the parallelogram identity. These identities explain why many convenient Banach-space conclusions become sharper in Hilbert space.

For an orthonormal family $e_1,\ldots,e_N$, let $P_Nx=\sum_{j\le N}\langle x,e_j\rangle e_j$. The residual is orthogonal to their span, so
$$\|x\|^2=\sum_{j\le N}|\langle x,e_j\rangle|^2+\|x-P_Nx\|^2.$$
This proves Bessel's inequality. It also proves optimality: if $v$ belongs to the span, then $x-v=(x-P_Nx)+(P_Nx-v)$ is an orthogonal decomposition. Its squared norm is minimal, uniquely, when $v=P_Nx$.

**Worked example.** In $L^2(0,1)$ approximate $x^2$ by an affine function. Rather than solving normal equations in a nonorthogonal basis, use $e_0=1$ and $e_1=\sqrt{12}(x-1/2)$. Their inner product is zero and both norms are one. The coefficients are $1/3$ and $\sqrt{12}/12$, giving the approximation $x-1/6$. Its residual is orthogonal to both $1$ and $x$, which is an independent way to check the answer. Computing a few pointwise errors would not prove least-squares optimality.

## From a family to a basis

For a countable orthonormal family, Bessel shows the coefficient sequence is square-summable. Therefore its finite expansions form a Cauchy sequence, since the squared norm of a tail is the sum of squared coefficients. Completeness gives a limit $y$. The difference $x-y$ is orthogonal to every $e_j$. If the family is **complete**, meaning its closed span is all of $H$, this difference must be zero. Consequently
$$x=\sum_j\langle x,e_j\rangle e_j,\qquad \|x\|^2=\sum_j|\langle x,e_j\rangle|^2.$$
The second identity is Parseval. An orthonormal basis permits infinite norm-convergent series; it is not a Hamel basis, whose expansions are finite. For separable Hilbert spaces a countable orthonormal basis exists by applying Gram–Schmidt to a countable dense set and discarding dependencies.

## Fourier analysis with the convergence specified

On $[-\pi,\pi]$ the functions $e_n(x)=e^{inx}/\sqrt{2\pi}$, $n\in\mathbb Z$, are orthonormal. Put $\widehat f(n)=(2\pi)^{-1}\int f(x)e^{-inx}\,dx$. Then the finite Fourier projection is $S_Nf=\sum_{|n|\le N}\widehat f(n)e^{inx}$. Its being an orthogonal projection is immediate; its converging to every $f$ requires density of trigonometric polynomials.

Fejér averages $\sigma_Nf=(N+1)^{-1}\sum_{k=0}^NS_kf$ have a nonnegative convolution kernel of total mass one. Away from any fixed neighbourhood of zero, that kernel's mass tends to zero. Split the convolution error into a near part controlled by uniform continuity and a far part controlled by that disappearing mass. This proves uniform convergence of Fejér averages for continuous periodic functions. Density of these functions in $L^2$, together with the contraction estimate for the averages, gives $L^2$ convergence for every $L^2$ function. Thus a function with all Fourier coefficients zero is zero in $L^2$, proving completeness. The source reading supplies the kernel formula and the estimates; derive them before treating this paragraph as a proof you can reproduce.

**Worked example.** If $f=1$ on $(0,\pi)$ and $f=-1$ on $(-\pi,0)$, orthogonality does not imply uniform convergence of its trigonometric polynomials: a uniform limit of continuous functions would be continuous. The Hilbert-space conclusion is $\|S_Nf-f\|_2\to0$. It says nothing by itself about convergence at a particular jump or at every point. Distinguishing these conclusions prevents a valid norm theorem from becoming an invalid pointwise claim.

On the sheet, use the projection identity first and compute second. After a gap, reconstruct the sentence “Bessel plus completeness plus trivial orthogonal complement implies Parseval,” explaining what each ingredient contributes.
