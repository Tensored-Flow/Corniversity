# Measurable functions and the integral

The construction now changes its focus from intervals in the domain to levels in the range. A step function constant on arbitrary measurable sets is easy to integrate. Approximate a nonnegative function from below by such simple functions, and a limiting operation becomes part of the definition rather than a later repair.

Read MIT 18.102 Lectures [9](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/ede0e9d0812d4b602efafe3ca879b19f_MIT18_102s21_lec9.pdf), [10](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/ebbbc59aa40252dff3d4ec766c057451_MIT18_102s21_lec10.pdf), and [11](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/615c26170233747c081d6dab928f7d91_MIT18_102s21_lec11.pdf). The proofs of simple approximation and monotone convergence are core reading, not optional background.

## Measurability is a closure condition

For a measurable domain $E$, an extended-real function $f$ is measurable if $\{x\in E:f(x)>a\}$ is measurable for every real $a$. Equivalent tests use closed rays or inverse images of Borel sets. For example
$$\{f\ge a\}=\bigcap_{n=1}^{\infty}\{f>a-1/n\}.$$
Countability is doing work. Countable suprema and infima of measurable functions are measurable because their superlevel or sublevel sets are countable unions or intersections. Consequently pointwise limits are measurable. Continuous functions are measurable; the converse is very far from true.

A simple function has finite range, not necessarily a domain partition into intervals. Write $s=\sum_{j=1}^k a_j1_{A_j}$ using disjoint measurable level sets. For $s\ge0$, define $\int s=\sum a_jm(A_j)$, with the convention $0\cdot\infty=0$. If a different representation is used, refine both partitions by intersections. Additivity of measure proves the same value. Without this check the proposed integral would depend on notation.

## Worked example: rounding height, not horizontal position

For a nonnegative measurable $f$, put
$$s_n(x)=\min\{n,2^{-n}\lfloor2^nf(x)\rfloor\},$$
with the value $n$ when $f(x)=\infty$. Each $s_n$ takes finitely many values on measurable sets. The finer dyadic grid and growing truncation imply $s_n\le s_{n+1}\le f$. At a point where $f$ is finite, eventually the truncation is inactive and $0\le f-s_n<2^{-n}$; at an infinite point $s_n=n\to\infty$. Hence $s_n\uparrow f$ everywhere. Test this construction on $f(x)=1/x$ on $(0,1)$: finitely many levels approximate an unbounded function without pretending it is bounded.

Define
$$\int_E f=\sup\{\int_E s:0\le s\le f,\ s\text{ simple}\}.$$
The value lies in $[0,\infty]$. Monotonicity follows immediately. A nonnegative function has integral zero exactly when it is zero almost everywhere: if its integral is zero, each set $\{f>1/k\}$ has measure zero, and their union is $\{f>0\}$. This explains why later $L^p$ spaces identify functions differing on null sets.

## Why increasing limits work

If $0\le f_n\uparrow f$ are measurable, then $I=\lim\int f_n\le\int f$. For the other direction fix a nonnegative simple $s\le f$ and $0<c<1$. Set $E_n=\{f_n\ge cs\}$. On the positive level sets of $s$, these sets increase to the whole level set, so continuity from below of measure gives $\int_{E_n}s\to\int s$. Since $f_n\ge cs1_{E_n}$,
$$I\ge c\int s.$$
Let $c\uparrow1$ and then take the supremum over $s$. This proves the **monotone convergence theorem**, including infinite integrals. The factor $c<1$ avoids requiring that $f_n$ ever reach its limit exactly.

Apply monotone convergence to partial sums to obtain $\int\sum f_n=\sum\int f_n$ for nonnegative terms. This statement permits infinity; it is not a licence to interchange arbitrary signed series.

## Worked example: Fatou and disappearing mass

For nonnegative $f_n$, let $g_N=\inf_{n\ge N}f_n$. Then $g_N\uparrow\liminf f_n$ and $\int g_N\le\inf_{n\ge N}\int f_n$. Monotone convergence yields
$$\int\liminf f_n\le\liminf\int f_n.$$
On $(0,1)$ take $f_n=n1_{(0,1/n)}$. It converges pointwise to zero but every integral is one. Fatou's inequality is strict. The sequence is not increasing, and there is no integrable function dominating it. A limit can lose mass concentrated into narrower regions.

In the sheet you will contrast monotone approximation, passage of limits through an infinite sum, and the role of nonnegativity. In your own explanation always state the domain and measure: “almost everywhere” means outside a measurable null set relative to that measure, not “at most finitely many exceptions.”
