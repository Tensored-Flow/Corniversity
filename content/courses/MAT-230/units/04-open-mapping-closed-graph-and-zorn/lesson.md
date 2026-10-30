## The open mapping theorem

A map between metric spaces is *open* if it sends open sets to open sets. Continuity is the reverse condition (preimages of open sets are open), and in general neither implies the other. For bounded linear surjections between Banach spaces, however, openness comes for free.

**Theorem (open mapping).** Let $B_1,B_2$ be Banach spaces and $T\in B(B_1,B_2)$ surjective. Then $T$ is an open map (lecture 4, Theorem 37).

**Proof (structure; the notes give every step).** By linearity it suffices to show $T(B(0,1))$ contains some ball $B(0,\delta)$ in $B_2$.

*Half one (Baire).* $B_2=\bigcup_n T(B(0,n))=\bigcup_n\overline{T(B(0,n))}$ by surjectivity. The closures are closed sets covering the complete space $B_2$, so by Baire one of them contains a ball; scaling and translating (using linearity and symmetry of balls) gives $\overline{T(B(0,1))}\supseteq B(0,2\delta)$ for some $\delta>0$.

*Half two (completeness of $B_1$).* Removing the closure costs a factor of 2. Given $y\in B(0,\delta)$, pick $x_1\in B(0,\tfrac12)$ with $\|y-Tx_1\|<\delta/2$, then $x_2\in B(0,\tfrac14)$ with $\|y-Tx_1-Tx_2\|<\delta/4$, and so on. The series $\sum x_k$ is absolutely summable in the Banach space $B_1$, so converges to some $x$ with $\|x\|<1$ (Theorem 19 from unit 2), and continuity of $T$ gives $Tx=y$. $\square$

Both completeness hypotheses are used, in different halves. Keep that in mind when you meet an operator between spaces one of which is not complete.

**Corollary (bounded inverse).** If $B_1,B_2$ are Banach spaces and $T\in B(B_1,B_2)$ is bijective, then $T^{-1}\in B(B_2,B_1)$ (Corollary 38).

**Proof.** $T^{-1}$ is continuous iff preimages of open sets under $T^{-1}$ are open, i.e. iff $T(U)$ is open for every open $U$, which is the open mapping theorem. $\square$

This is the theorem that explains unit 2's Volterra operator. $T:C([0,1])\to\operatorname{ran}T$ is bounded and bijective, and $\operatorname{ran}T$ (the $C^1$ functions vanishing at $0$, with the sup norm) is a normed space; its inverse, differentiation, is unbounded. There is no contradiction because $\operatorname{ran}T$ is not complete in the sup norm. The theorem's hypothesis is doing work.

**Proposition.** If $B_1,B_2$ are Banach spaces, then $B_1\times B_2$ with $\|(b_1,b_2)\|=\|b_1\|+\|b_2\|$ is a Banach space (Proposition 39). Convergence in the product is convergence in each coordinate.

## The closed graph theorem

For a linear map $T:B_1\to B_2$, the graph is $\Gamma(T)=\{(u,Tu):u\in B_1\}\subseteq B_1\times B_2$. If $T$ is continuous then $\Gamma(T)$ is closed: if $u_n\to u$ and $Tu_n\to v$ then $v=Tu$. The remarkable fact is the converse.

**Theorem (closed graph).** Let $B_1,B_2$ be Banach spaces and $T:B_1\to B_2$ a linear operator, not assumed bounded. Then $T\in B(B_1,B_2)$ if and only if $\Gamma(T)$ is closed in $B_1\times B_2$ (Theorem 40).

**Proof of the hard direction.** $\Gamma(T)$ is a closed subspace of the Banach space $B_1\times B_2$, hence Banach (unit 3, Proposition 30). The projection $\pi_1:\Gamma(T)\to B_1$, $(u,Tu)\mapsto u$, is bounded (norm $\le1$), linear and bijective, so by the bounded inverse theorem $\pi_1^{-1}:u\mapsto(u,Tu)$ is bounded: $\|u\|+\|Tu\|\le C\|u\|$, hence $\|Tu\|\le C\|u\|$. $\square$

The practical value: to prove an operator on a Banach space is bounded, it suffices to check that whenever $u_n\to u$ *and* $Tu_n\to v$, we have $v=Tu$. One is allowed to assume the convergence of $Tu_n$, which is often exactly the extra leverage needed. Exercise 2 applies this to an operator on $C([0,1])$.

The notes remark (Remark 41) that the closed graph theorem also implies the open mapping theorem, so the two are logically equivalent.

## Zorn's lemma

The remaining big theorem, Hahn–Banach, extends a functional from a subspace to the whole space. In infinite dimensions one cannot do this step by step in countably many stages; one needs a principle that produces a maximal object.

**Definition (partial order).** A relation $\preceq$ on a set $E$ that is reflexive, antisymmetric and transitive (Definition 42). Not every pair need be comparable: inclusion on the power set of a set is the standard example (Example 43).

**Definition (chain).** A subset $C\subseteq E$ in which any two elements are comparable (Definition 44).

**Proposition (Zorn's lemma).** If every chain in a nonempty partially ordered set $E$ has an upper bound in $E$, then $E$ contains a maximal element (Proposition 45). The notes take this as an axiom of set theory; it is equivalent to the axiom of choice.

**Definition (Hamel basis).** A linearly independent subset $H\subseteq V$ such that every vector is a finite linear combination of elements of $H$ (Definition 46).

Zorn's lemma shows every vector space has a Hamel basis: order the linearly independent subsets by inclusion; the union of a chain of independent sets is independent (any finite dependence lives in one member of the chain), so is an upper bound; a maximal independent set must span, otherwise adjoining a vector outside its span would enlarge it. Exercise 3 asks you to write this out and to connect it with unit 3: in an infinite-dimensional Banach space, such a basis is uncountable, which is why Hamel bases are rarely useful there and *orthonormal* bases (unit 9) take their place.

## What to carry forward

Between Banach spaces: a bounded surjection is open; a bounded bijection has a bounded inverse; a linear map with closed graph is bounded. Each statement fails when a completeness hypothesis is dropped, and the Volterra operator is your standing example of why. Zorn's lemma supplies maximal objects when induction cannot; next unit it supplies the Hahn–Banach extension.
