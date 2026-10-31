## Positive measures

**Definition (positive measure).** Let $(X,\mathcal M)$ be a measurable space. A *positive measure* is a function $\mu:\mathcal M\to[0,\infty]$ that is countably additive: for every sequence of pairwise disjoint sets $A_i\in\mathcal M$,
$$\mu\Big(\bigcup_{i=1}^\infty A_i\Big)=\sum_{i=1}^\infty\mu(A_i)$$
(lecture 2, page 3). To exclude the useless measure that is identically $\infty$ one also requires $\mu(E)<\infty$ for at least one $E$. The triple $(X,\mathcal M,\mu)$ is a *measure space*.

**Example.** On any set $X$ with $\mathcal M=\mathcal P(X)$: *counting measure*, $\mu(E)=\#E$ for finite $E$ and $\mu(E)=\infty$ otherwise; and the *Dirac mass* at $x_0$, $\delta_{x_0}(E)=1$ if $x_0\in E$ and $0$ otherwise (lecture 3, page 2). Both are countably additive by inspection. Lebesgue measure on $\mathbb R^n$, the measure this course is really about, is constructed in units 4 and 5; everything in this unit is proved for an arbitrary positive measure and will apply to it.

**Theorem (properties of a positive measure).** Let $\mu$ be a positive measure on $(X,\mathcal M)$.

1. $\mu(\emptyset)=0$.
2. (Monotonicity) If $A\subset B$ then $\mu(A)\le\mu(B)$.
3. (Continuity from below) If $A_1\subset A_2\subset\cdots$ and $A=\bigcup_iA_i$ then $\mu(A_i)\to\mu(A)$.
4. (Continuity from above) If $A_1\supset A_2\supset\cdots$, $A=\bigcap_iA_i$ and $\mu(A_1)<\infty$, then $\mu(A_i)\to\mu(A)$.

(Lecture 3, Theorem 0.2.)

**Proof.** (1) Take $E$ with $\mu(E)<\infty$; $E=E\cup\emptyset\cup\emptyset\cup\cdots$ disjointly, so $\mu(E)=\mu(E)+\sum\mu(\emptyset)$, forcing $\mu(\emptyset)=0$. (2) $B=A\cup(B\setminus A)$ disjointly, so $\mu(B)=\mu(A)+\mu(B\setminus A)\ge\mu(A)$. (3) Disjointify: $B_1=A_1$, $B_i=A_i\setminus A_{i-1}$. Then $A_n=B_1\cup\cdots\cup B_n$ and $A=\bigcup_iB_i$, so $\mu(A_n)=\sum_{i\le n}\mu(B_i)\to\sum_i\mu(B_i)=\mu(A)$. (4) Let $C_n=A_1\setminus A_n$, increasing to $A_1\setminus A$. By (3), $\mu(A_1\setminus A)=\lim\mu(C_n)$. Because $\mu(A_1)<\infty$, all the sets involved have finite measure and we may subtract: $\mu(C_n)=\mu(A_1)-\mu(A_n)$ and $\mu(A_1\setminus A)=\mu(A_1)-\mu(A)$. Hence $\mu(A_n)\to\mu(A)$. $\square$

Countable subadditivity, $\mu(\bigcup A_i)\le\sum\mu(A_i)$ for arbitrary (not necessarily disjoint) $A_i$, follows by disjointifying and using monotonicity.

**Warning.** Property (4) genuinely needs the finiteness hypothesis. With counting measure on $\mathbb N$ and $A_n=\{n,n+1,n+2,\dots\}$, every $\mu(A_n)=\infty$ while $\bigcap_nA_n=\emptyset$ has measure $0$. The subtraction in the proof is where finiteness was used. Keep this example: the same tail sets reappear in exercise 2 as the reason the monotone convergence theorem has no free "decreasing" version.

## The integral of a nonnegative function

**Definition (integral of a simple function).** Let $s=\sum_{i=1}^N\alpha_i\chi_{A_i}$ be a measurable simple function with $\alpha_i\in[0,\infty)$ and the $A_i\in\mathcal M$ pairwise disjoint. For $E\in\mathcal M$,
$$\int_E s\,d\mu=\sum_{i=1}^N\alpha_i\,\mu(A_i\cap E),$$
with the convention $0\cdot\infty=0$ (lecture 2, page 3).

The definition appears to depend on how $s$ is written. It does not: the canonical representation ($\alpha_i$ the distinct values, $A_i=\{s=\alpha_i\}$) gives one value, and any other representation by disjoint sets refines the canonical one (each $A_i$ of the canonical form is a finite disjoint union of the sets carrying the value $\alpha_i$), so finite additivity of $\mu$ shows the two sums agree.

**Definition (integral of a nonnegative measurable function).** For measurable $f:X\to[0,\infty]$ and $E\in\mathcal M$,
$$\int_Ef\,d\mu=\sup\Big\{\int_Es\,d\mu:\ 0\le s\le f,\ s\text{ simple and measurable}\Big\}$$
(lecture 2, page 4). When $f$ is itself simple the two definitions agree, because the simple integral is monotone in $s$.

**Proposition (elementary properties).** For measurable $f,g\ge0$, $E,A,B\in\mathcal M$ and $c\in[0,\infty)$:
(a) $f\le g$ on $E$ implies $\int_Ef\le\int_Eg$; (b) $A\subset B$ implies $\int_Af\le\int_Bf$; (c) $\int_Ecf=c\int_Ef$; (d) $f=0$ on $E$ implies $\int_Ef=0$; (e) $\mu(E)=0$ implies $\int_Ef=0$; (f) $\int_Ef=\int_X\chi_Ef$ (lecture 3, pages 2–3).

**Proof.** (a) Every simple $s\le f$ on $E$ is also $\le g$ there, so the supremum defining $\int_Eg$ is over a larger class. (b) For simple $s$, $\mu(A_i\cap A)\le\mu(A_i\cap B)$ termwise. (c) For $c>0$, $s\le cf$ if and only if $s/c\le f$, and the simple integral is homogeneous; $c=0$ is the convention. (d) and (e): every term $\alpha_i\mu(A_i\cap E)$ of a simple $s\le f$ vanishes, in (d) because $\alpha_i=0$ wherever $A_i$ meets $E$, in (e) because $\mu(A_i\cap E)=0$. (f) is a direct comparison of the two suprema. $\square$

**Warning.** Nothing so far gives $\int(f+g)=\int f+\int g$. From $s\le f$ and $t\le g$ we get $s+t\le f+g$, hence only $\int(f+g)\ge\int f+\int g$ (lecture 4, page 2). The reverse inequality is a theorem, and the tool for it is the subject of this unit.

**Proposition (additivity on simple functions).** If $s,t\ge0$ are measurable simple functions then $\int_X(s+t)\,d\mu=\int_Xs\,d\mu+\int_Xt\,d\mu$. Moreover $E\mapsto\int_Es\,d\mu$ is a positive measure on $\mathcal M$ (lecture 4, Proposition 0.1).

**Proof.** Write $s=\sum_i\alpha_i\chi_{A_i}$, $t=\sum_j\beta_j\chi_{B_j}$ with disjoint representations and put $E_{ij}=A_i\cap B_j$; the $E_{ij}$ partition $X$ and $s+t$ is constant, equal to $\alpha_i+\beta_j$, on $E_{ij}$. Summing $(\alpha_i+\beta_j)\mu(E_{ij})$ over $i,j$ gives $\int(s+t)$ on the left and, after splitting the sum, $\int s+\int t$ on the right. For the measure statement, $E\mapsto\alpha_i\mu(A_i\cap E)$ is countably additive for each $i$ and a finite sum of measures is a measure. $\square$

## Monotone convergence

**Theorem (monotone convergence).** Let $f_n:X\to[0,\infty]$ be measurable with $0\le f_1\le f_2\le\cdots$ and $f_n(x)\to f(x)$ for every $x\in X$. Then $f$ is measurable and
$$\int_Xf_n\,d\mu\longrightarrow\int_Xf\,d\mu$$
(lecture 4, Theorem 0.2).

**Proof.** Measurability of $f$ is unit 1. By property (a) the sequence $\int f_n$ is increasing, so it converges to some $\alpha\in[0,\infty]$, and $f_n\le f$ gives $\alpha\le\int f$. For the reverse inequality fix a measurable simple $s$ with $0\le s\le f$ and a constant $c\in(0,1)$, and let $E_n=\{x: f_n(x)\ge c\,s(x)\}$. Each $E_n$ is measurable, $E_1\subset E_2\subset\cdots$ because the $f_n$ increase, and $\bigcup_nE_n=X$: if $s(x)=0$ then $x\in E_1$; if $s(x)>0$ then $c\,s(x)<s(x)\le f(x)=\lim f_n(x)$, so $f_n(x)>c\,s(x)$ for all large $n$. Now
$$\int_Xf_n\,d\mu\ \ge\ \int_{E_n}f_n\,d\mu\ \ge\ c\int_{E_n}s\,d\mu .$$
Since $E\mapsto\int_Es$ is a measure, continuity from below gives $\int_{E_n}s\to\int_Xs$. Letting $n\to\infty$, $\alpha\ge c\int_Xs$; letting $c\uparrow1$, $\alpha\ge\int_Xs$; taking the supremum over $s$, $\alpha\ge\int_Xf$. $\square$

Where did each hypothesis go? Monotonicity made $\int f_n$ convergent and made the $E_n$ increase. Nonnegativity made the integrals defined and gave $\int_{E_n}f_n\le\int_Xf_n$. The factor $c<1$ handled points where $s(x)=f(x)$, which $f_n$ might never reach, and points where $f(x)=\infty$. No finiteness was assumed anywhere, which is why this theorem is the workhorse: it never needs an integrability check.

**Theorem (additivity and series).** If $f_n:X\to[0,\infty]$ are measurable, then $\int_X\sum_nf_n\,d\mu=\sum_n\int_Xf_n\,d\mu$. In particular $\int(f+g)=\int f+\int g$ for measurable $f,g\ge0$ (lecture 4, Theorem 0.3).

**Proof.** Choose simple $s_i\uparrow f$ and $t_i\uparrow g$ by the approximation theorem; then $s_i+t_i$ are simple and increase to $f+g$. Additivity on simple functions and three applications of monotone convergence give $\int(f+g)=\lim\int(s_i+t_i)=\lim\int s_i+\lim\int t_i=\int f+\int g$. Induction gives finite sums, and monotone convergence applied to the partial sums $g_N=\sum_{n\le N}f_n\uparrow\sum_nf_n$ gives the series. $\square$

**Corollary (interchanging sums).** Take $X=\mathbb N$ with counting measure and $f_j(i)=a_{ij}\ge0$. Then $\sum_i\sum_ja_{ij}=\sum_j\sum_ia_{ij}$ (lecture 4, Corollary 0.4). Exercise 1 asks you to make the link "integral against counting measure equals sum" precise, which is what turns this corollary into a theorem about double series.

**Lemma (Fatou).** For measurable $f_n:X\to[0,\infty]$,
$$\int_X\liminf_{n\to\infty}f_n\,d\mu\ \le\ \liminf_{n\to\infty}\int_Xf_n\,d\mu$$
(lecture 4, Lemma 0.5).

**Proof.** Let $g_k=\inf_{n\ge k}f_n$. Then $g_k$ is measurable, $g_1\le g_2\le\cdots$, $g_k\uparrow\liminf f_n$, and $g_k\le f_k$. By monotone convergence, $\int\liminf f_n=\lim_k\int g_k=\liminf_k\int g_k\le\liminf_k\int f_k$. $\square$

**Example (the inequality can be strict).** On $\mathbb N$ with counting measure let $f_n=\chi_{\{n\}}$. Then $f_n(k)\to0$ for every $k$, so the left side is $0$, while $\int f_n=1$ for every $n$. Mass can escape to infinity; Fatou says it cannot appear from nowhere.

**Warning.** There is no decreasing monotone convergence theorem without a finiteness hypothesis. The tail indicators $f_n=\chi_{\{n,n+1,\dots\}}$ on $\mathbb N$ decrease pointwise to $0$, yet $\int f_n=\infty$ for every $n$. Exercise 2 asks you to find the right hypothesis and prove the theorem under it.

## What to carry forward

A positive measure is countably additive, monotone, continuous from below, and continuous from above only when the sets have finite measure. The integral of a nonnegative function is a supremum over simple functions below it; monotone convergence lets us compute it as a limit, proves additivity, integrates series termwise and yields Fatou's lemma. Every convergence theorem in this course is this one in disguise. Next unit: integrable functions, the dominated convergence theorem, and sets of measure zero.
