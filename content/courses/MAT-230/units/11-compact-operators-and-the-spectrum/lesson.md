# Compact operators and the spectrum

A finite matrix sends bounded sets into sets with compact closure. An infinite-dimensional identity does not: the orthonormal vectors remain a fixed distance apart. Compact operators are those that recover the finite-dimensional compactness property without necessarily having finite-dimensional range. Spectral theory asks when an operator equation can be solved stably, not merely when a homogeneous equation has a nonzero solution.

Read MIT 18.102 Lectures [19](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/39ac233d5d7cbfffcdce8086143688f6_MIT18_102s21_lec19.pdf) and [20](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/9eaaf363541d01d53c330ee7931fc715_MIT18_102s21_lec20.pdf). The compact-set tail criterion and its operator consequence are part of the reading. We work on a separable complex Hilbert space unless otherwise stated.


**Source-reading correction (Lecture 20, Proposition 213).** The factor near the identity is $I+T_0^{-1}(T-T_0)=T_0^{-1}T$. The proof prints a minus where this plus is needed. If $\|T_0^{-1}(T-T_0)\|<1$, invert this plus factor using the alternating Neumann series and then preserve the order of multiplication. The perturbation argument below uses that corrected factorization.


## Compactness is uniform control of tails

A bounded operator $K$ is compact if every bounded sequence $(x_n)$ has a subsequence for which $(Kx_n)$ converges. Equivalently, the image of its closed unit ball has compact closure. It need not be closed itself. Finite-rank operators are compact because their bounded images lie in a finite-dimensional space. Norm limits of compact operators are compact: approximate the image of the unit ball by a finite net for a nearby compact image, giving total boundedness, then use completeness.

If $P_N$ projects onto the first $N$ vectors of an orthonormal basis, compactness of the closure of $K$'s unit-ball image makes the tails uniformly small:
$$\sup_{\|x\|\le1}\|(I-P_N)Kx\|\longrightarrow0.$$
One proof covers that compact image by finitely many small balls and chooses one $N$ controlling the finitely many centres. Thus $P_NK\to K$ in operator norm and each $P_NK$ has finite rank. Pointwise convergence $P_Nx\to x$ alone would not justify the supremum: for the identity on an infinite-dimensional space, $\|I-P_N\|=1$ for every $N$.

## Worked example: a diagonal laboratory

For a bounded scalar sequence $a=(a_n)$, define $D_ax=(a_nx_n)$ on $\ell^2$. Its norm is $\sup_n|a_n|$: the upper bound follows by summing squares and the lower bound by testing $e_n$. Truncating the diagonal yields a finite-rank operator with error $\sup_{n>N}|a_n|$. Consequently $a_n\to0$ implies compactness.

Conversely, if $|a_{n_j}|\ge\varepsilon>0$ infinitely often, then $D_ae_{n_j}$ are pairwise separated by at least $\sqrt2\varepsilon$. They have no convergent subsequence, so $D_a$ is not compact. This gives a complete criterion, and shows why a small-looking entrywise limit must be uniform on the tail to control operator norm.

## Invertibility means a bounded inverse

For $\|T\|<1$, the series $\sum_{n\ge0}T^n$ converges in operator norm because $B(H)$ is complete. Multiplying partial sums gives $(I-T)\sum_{n=0}^NT^n=I-T^{N+1}$; passing to the norm limit proves
$$(I-T)^{-1}=\sum_{n=0}^{\infty}T^n,\qquad\|(I-T)^{-1}\|\le\frac1{1-\|T\|}.$$
If $A$ is invertible and $\|A^{-1}(B-A)\|<1$, factor $B=A[I+A^{-1}(B-A)]$. The series proves $B$ invertible. This is both a perturbation estimate and the reason the resolvent set is open.

The **spectrum** of $A$ is $\sigma(A)=\{\lambda\in\mathbb C:A-\lambda I\text{ has no bounded everywhere-defined inverse}\}$. In Banach spaces a bounded bijection automatically has bounded inverse, but injectivity alone is not enough. If $|\lambda|>\|A\|$, factor $A-\lambda I=-\lambda(I-A/\lambda)$ and use the series. Hence $\sigma(A)$ is closed and contained in the closed disk of radius $\|A\|$.

## Worked example: a spectral point without an eigenvector

For $D x=(x_n/n)$, zero is not an eigenvalue, since $Dx=0$ forces every coordinate zero. Yet $De_n\to0$ while $\|e_n\|=1$. A bounded inverse would imply $1\le\|D^{-1}\|/n$, impossible. Thus zero is in the spectrum. In fact $\sigma(D)=\{1,1/2,1/3,\ldots\}\cup\{0\}$: away from this closed set the inverse is the bounded diagonal with entries $(1/n-\lambda)^{-1}$.

For self-adjoint operators the spectrum is real. The estimate $\|(A-\lambda I)x\|\ge |\operatorname{Im}\lambda|\|x\|$ gives injectivity and closed range when the imaginary part is nonzero; applying the same estimate to the adjoint makes the range dense, hence surjective. A lower bound alone would not have proved onto-ness.

The next unit adds compactness to self-adjointness and recovers an orthonormal eigen-expansion. Before using that theorem, the sheet asks you to check what fails when compactness or the distinction between spectrum and eigenvalues is ignored.
