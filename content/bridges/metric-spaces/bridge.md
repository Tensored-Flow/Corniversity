## Cauchy sequences

In a metric space $(X, d)$ a sequence $(x_n)$ is **Cauchy** if its terms eventually stay arbitrarily close to *each other*:

$$\forall \varepsilon > 0\ \exists N\ \forall m, n \ge N:\ d(x_m, x_n) < \varepsilon.$$

Every convergent sequence is Cauchy: if $x_n \to x$, then $d(x_m, x_n) \le d(x_m, x) + d(x, x_n)$, and both terms are eventually below $\varepsilon/2$. The converse is the interesting part. A Cauchy sequence *looks as if* it converges, but the point it is heading for may be missing from the space.

- In $\mathbb{Q}$, the decimal truncations $1, 1.4, 1.41, 1.414, \dots$ of $\sqrt 2$ form a Cauchy sequence with no limit in $\mathbb{Q}$.
- In $(0, 1]$ with the usual distance, $x_n = 1/n$ is Cauchy, and its would-be limit $0$ has been removed.

A metric space is **complete** if every Cauchy sequence in it converges *to a point of the space*. A normed space that is complete in the metric $d(x,y) = \lVert x - y\rVert$ is a **Banach space**.

## Completeness is intrinsic; closedness is relative

$(0,1]$ is not complete, yet it is a perfectly good metric space; it is not closed *in* $\mathbb{R}$. "Closed" always means closed in some larger space, whereas completeness is a property of the space alone. The two are linked by a fact used constantly in functional analysis:

> A subset $Y$ of a complete metric space $X$ is complete (with the restricted metric) exactly when it is closed in $X$.

So to show a subspace of a Banach space is a Banach space, show it is closed.

## Worked example: same functions, two norms

On $C([0,1])$, the continuous functions, compare two norms.

**Sup norm** $\lVert f\rVert_\infty = \max|f|$. Convergence is uniform convergence, a uniform limit of continuous functions is continuous, and so $(C([0,1]), \lVert\cdot\rVert_\infty)$ is complete. This is a case of the theorem that $C_\infty(X)$ is complete.

**Integral norm** $\lVert f\rVert_1 = \int_0^1 |f|$. Take the ramps (for $n \ge 2$)

$$f_n(x) = \begin{cases} 0, & 0 \le x \le \tfrac12,\\ n\,(x - \tfrac12), & \tfrac12 \le x \le \tfrac12 + \tfrac1n,\\ 1, & \tfrac12 + \tfrac1n \le x \le 1.\end{cases}$$

For $m > n$, $f_m - f_n$ is zero outside $[\tfrac12, \tfrac12 + \tfrac1n]$ and has absolute value at most 1 there, so $\lVert f_m - f_n\rVert_1 \le 1/n$: the sequence is Cauchy. If it converged in $\lVert\cdot\rVert_1$ to a continuous $g$, then $g$ would have to be $0$ on $[0,\tfrac12)$ and $1$ on $(\tfrac12, 1]$, which no continuous function is. So $(C([0,1]), \lVert\cdot\rVert_1)$ is **not** complete: the "limit" is a step function, outside the space.

The lesson: completeness depends on the norm, not just on the set.

## Why theorems need it

Many results build an object as the limit of a sequence and then use it. They need the limit to exist *in the space*:

- **Series.** In a normed space, every absolutely convergent series converges if and only if the space is complete. This is how $\sum_{n} T^n$ is shown to converge in the space of bounded operators when $\lVert T\rVert < 1$.
- **Fixed points.** The contraction mapping theorem produces the fixed point as the limit of iterates, which are Cauchy.
- **Baire category.** The uniform boundedness principle and the open mapping theorem rest on the Baire category theorem, which needs completeness.

When you meet a hypothesis "let $X$ be a Banach space", ask which limit the proof is going to take. That is where completeness is used, and dropping it is the usual way such a theorem fails.
