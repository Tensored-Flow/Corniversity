# Outer measure, σ-algebras and Lebesgue measure

We want an integral compatible with limits of functions. Before defining an integral we need a notion of the size of sets. Length on intervals is familiar; extending it to every subset while preserving all desirable properties is impossible. The successful construction first assigns an outer size to every set, then restricts to sets that split other sets additively.

The source sequence is MIT 18.102 [Lecture 6](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/806234baa2feadee4b54cdf679382257_MIT18_102s21_lec6.pdf), outer measure; [Lecture 7](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/822b1a9ec1fbf16192b5564621d3b387_MIT18_102s21_lec7.pdf), measurable sets and σ-algebras; and [Lecture 8](https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/1bf275c0667d3e903e4de22b9fb4481b_MIT18_102s21_lec8.pdf), countable additivity and continuity of measure. Read the proof that measurable sets form a σ-algebra as part of this unit; the argument below isolates its reusable mechanism.

## A size built from coverings

For $A\subset\mathbb R$, define
$$m^*(A)=\inf\left\{\sum_{j=1}^{\infty}|I_j|: A\subset\bigcup_j I_j,\ I_j\text{ open intervals}\right\}.$$
The infimum may be infinite. Empty-set size and monotonicity follow directly. For countable subadditivity, choose, for each $A_k$ of finite outer measure, a covering with cost within $\varepsilon2^{-k}$ of its infimum. Combining all coverings covers their union and costs at most $\sum_km^*(A_k)+\varepsilon$. Send $\varepsilon$ to zero. If the right side is infinite the inequality already holds. Notice the summable errors: choosing an error of $\varepsilon$ for each set would not work.

Proving $m^*([a,b])=b-a$ requires more than the definition. Slightly enlarged intervals give the upper bound. Any open cover of $[a,b]$ has a finite subcover by compactness, and the total lengths of a finite family covering an interval cannot be smaller than its length. This gives the lower bound. The result extends to all interval types by monotonicity and approximation.

## Worked example: a dense set with zero measure

Enumerate the rationals in $[0,1]$ as $(q_j)$. Cover $q_j$ by an interval of length $\varepsilon2^{-j}$. The total length is at most $\varepsilon$, however small it is. Thus the rationals in $[0,1]$ have outer measure zero although every nonempty subinterval contains one. Density describes proximity; measure describes size. Neither implies the other.

A set $E$ is **Lebesgue measurable** when, for every test set $A\subset\mathbb R$,
$$m^*(A)=m^*(A\cap E)+m^*(A\setminus E).$$
Subadditivity always gives the $\le$ direction. Measurability is the reverse inequality, saying a cut along $E$ introduces no artificial overlap of size. The test set need not be measurable. Testing only $A=\mathbb R$ would usually yield the uninformative equation $\infty=\infty$.

If $m^*(E)=0$, then $m^*(A\cap E)=0$ and monotonicity gives $m^*(A\setminus E)\le m^*(A)$. Together with subadditivity this proves equality. Every subset of a null set is therefore measurable: this is **completeness** of Lebesgue measure, not completeness of a normed space.

## From finite splitting to countable addition

Complement closure is immediate from the symmetric definition. Repeated splitting proves closure under finite unions. For disjoint measurable $E_j$, finite splitting gives
$$m^*(A)\ge\sum_{j=1}^N m^*(A\cap E_j)+m^*(A\setminus\bigcup_jE_j).$$
Let $N$ grow and use subadditivity to bound $m^*(A\cap\bigcup_jE_j)$ by the infinite sum. This proves that the union is measurable. Arbitrary unions are reduced to disjoint ones by replacing $E_n$ with $E_n\setminus\bigcup_{j<n}E_j$. Taking $A=\bigcup_jE_j$ also proves countable additivity of $m=m^*|_{\mathcal M}$. Thus measurable sets form a σ-algebra and $m$ is a measure on it.

Open rays are measurable by splitting interval coverings at an endpoint. Open sets of the real line are countable unions of intervals, hence measurable. Therefore every Borel set is Lebesgue measurable. The converse is false: completing the Borel measure adds all subsets of null sets. We do not need a non-Borel example to apply the theory.

## Worked example: a hypothesis that cannot be removed

If $E_n\uparrow E$, disjoint increments prove $m(E_n)\uparrow m(E)$, including infinite values. If $E_n\downarrow E$ and $m(E_1)<\infty$, apply the preceding result to $E_1\setminus E_n$ and subtract from the finite number $m(E_1)$. For $E_n=[n,\infty)$ the intersection is empty but every measure is infinite. Subtracting infinities would have hidden the failure.

This unit supplies the measurable sets used throughout the remaining analysis course. On the sheet, prove a covering statement, analyse a limsup event, and produce a dense open set of arbitrarily small measure. Return later to the exact quantifier “for every test set”: it is the hinge on which the construction turns.

## Assessed proof work

Exercise 4 is the actual mid-course assessment after this unit. It connects units 1–6 through quotient completeness, bounded inverse, Hahn–Banach separation and uniform boundedness, then tests the distinction between category and measure. Its activity includes the earlier exact source readings; use their stated hypotheses.
