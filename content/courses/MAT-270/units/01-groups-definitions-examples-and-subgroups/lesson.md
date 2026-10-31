## Two sources of examples

Judson opens chapter 3 not with the axioms but with two families of examples, and it is worth following him, because the axioms were extracted from exactly these.

**The integers mod $n$.** For $n\ge2$, $\mathbb Z_n=\{0,1,\dots,n-1\}$ with addition and multiplication reduced mod $n$. Both operations are commutative and associative, $0$ and $1$ are identities, multiplication distributes over addition, and every $a$ has an additive inverse $n-a$ (Proposition 3.1.4, parts 1–5). Multiplicative inverses are the interesting part: in $\mathbb Z_8$ the classes $2,4,6$ have none (Example 3.1.2), and $3\cdot4\equiv0\pmod{12}$ shows a product of nonzero classes can vanish (Example 3.1.1).

**Proposition.** Let $a\in\mathbb Z_n$ be nonzero. Then $a$ has a multiplicative inverse mod $n$ if and only if $\gcd(a,n)=1$ (Proposition 3.1.4, part 6).

**Proof.** If $\gcd(a,n)=1$, Bézout's identity (Section 2.2, revisited in unit 2) gives integers $r,s$ with $ar+ns=1$, so $ar\equiv1\pmod n$ and $r$ is an inverse. Conversely if $ab\equiv1$ then $ab-1=nk$ for some integer $k$; any common divisor of $a$ and $n$ divides $ab-nk=1$, so $\gcd(a,n)=1$. $\square$

**Symmetries.** A rectangle has four symmetries (identity, two reflections, the half-turn) and an equilateral triangle has six, one for each permutation of its vertices (Figures 3.1.5–3.1.7). Symmetries compose, the identity is a symmetry, and every symmetry can be undone. The multiplication table of the six triangle symmetries shows that the order of composition matters: a rotation followed by a reflection is not the same as the reflection followed by the rotation.

## The definition

**Definition (group).** A *group* $(G,\circ)$ is a set $G$ with a law of composition $(a,b)\mapsto a\circ b$ from $G\times G$ to $G$ such that

1. (associativity) $(a\circ b)\circ c=a\circ(b\circ c)$ for all $a,b,c\in G$;
2. (identity) there is $e\in G$ with $e\circ a=a\circ e=a$ for all $a\in G$;
3. (inverses) for each $a\in G$ there is $a^{-1}\in G$ with $a\circ a^{-1}=a^{-1}\circ a=e$.

$G$ is *abelian* if moreover $a\circ b=b\circ a$ for all $a,b$ (Section 3.2). The *order* $|G|$ is the number of elements. We write $ab$ for $a\circ b$ when no confusion arises.

The phrase "law of composition from $G\times G$ to $G$" carries a fourth, silent axiom: closure. When you check that something is a group, check closure first; it is the one most often forgotten.

**Example.** $(\mathbb Z,+)$ and $(\mathbb Z_n,+)$ are abelian groups (Examples 3.2.1–3.2.2). $\mathbb C^*=\mathbb C\setminus\{0\}$ under multiplication is an abelian group (Example 3.2.9). The six symmetries of the triangle form a non-abelian group of order $6$, written $S_3$ or $D_3$ (Example 3.2.6). The invertible $2\times2$ real matrices form the *general linear group* $GL_2(\mathbb R)$ under matrix multiplication: closure because $\det(AB)=\det A\det B\neq0$, associativity from matrix multiplication, identity $I$, inverses by invertibility; it is non-abelian (Example 3.2.7). The quaternion group $Q_8=\{\pm1,\pm i,\pm j,\pm k\}$ is a non-abelian group of order $8$ (Example 3.2.8).

**Example (the units).** $(\mathbb Z_n,\cdot)$ is *not* a group: $0$ has no inverse, and by the proposition neither does any $a$ with $\gcd(a,n)>1$. The fix is to keep only the invertible classes: $U(n)=\{a\in\mathbb Z_n:\gcd(a,n)=1\}$ is a group under multiplication mod $n$ (Example 3.2.4). Closure is the non-trivial check: if $a$ and $b$ have inverses $a'$ and $b'$ then $(ab)(b'a')=1$, so $ab$ is a unit. Associativity and the identity are inherited from $\mathbb Z_n$. For instance $U(8)=\{1,3,5,7\}$.

**Non-examples.** Each of the following fails exactly one axiom; name it. $(\mathbb N,+)$ with $\mathbb N=\{1,2,\dots\}$: no identity. $(\mathbb Z_{\ge0},+)$: identity but no inverses. $(\mathbb R,\cdot)$: $0$ has no inverse. $(\mathbb Z,-)$: not associative, since $(1-1)-1\neq1-(1-1)$. The $2\times2$ real matrices under multiplication: closed, associative, with identity, but singular matrices have no inverse.

## Basic properties

**Proposition.** In any group $G$: the identity is unique (3.2.10); each $a$ has a unique inverse (3.2.11); $(ab)^{-1}=b^{-1}a^{-1}$ (3.2.12); $(a^{-1})^{-1}=a$ (3.2.13); for all $a,b$ the equations $ax=b$ and $xa=b$ have unique solutions (3.2.14); and the cancellation laws hold: $ab=ac\Rightarrow b=c$ and $ba=ca\Rightarrow b=c$ (3.2.15).

**Proof.** If $e$ and $e'$ are both identities then $e=ee'=e'$. If $b$ and $c$ are both inverses of $a$ then $b=be=b(ac)=(ba)c=ec=c$. For the inverse of a product, $(ab)(b^{-1}a^{-1})=a(bb^{-1})a^{-1}=aa^{-1}=e$ and similarly on the other side, so $b^{-1}a^{-1}$ is an inverse of $ab$, hence the inverse. Cancellation: from $ab=ac$ multiply on the left by $a^{-1}$ and use associativity. The solution of $ax=b$ is $x=a^{-1}b$, and it is unique by cancellation. $\square$

Notice what cancellation uses: the existence of $a^{-1}$. In $(\mathbb Z_6,\cdot)$, which is associative with identity $1$, we have $2\cdot1=2\cdot4$ but $1\neq4$. The missing inverse of $2$ is exactly what breaks cancellation.

**Theorem (exponent laws).** For $g,h\in G$ and integers $m,n$, with $g^0=e$ and $g^{-n}=(g^{-1})^n$: $g^mg^n=g^{m+n}$, $(g^m)^n=g^{mn}$, and $(gh)^n=(h^{-1}g^{-1})^{-n}$, which simplifies to $g^nh^n$ when $G$ is abelian (Theorem 3.2.16). In additive notation these read $mg+ng=(m+n)g$, $m(ng)=(mn)g$, $m(g+h)=mg+mh$.

**Warning.** $(gh)^2=g^2h^2$ is false in general: in $S_3$ take two distinct reflections $g,h$; then $g^2=h^2=e$ while $gh$ is a nontrivial rotation, so $(gh)^2\neq e$. Exercise 1 turns this observation into a theorem.

**Definition (order of an element).** The *order* of $g\in G$ is the least positive integer $k$ with $g^k=e$, if one exists; otherwise $g$ has infinite order. In $S_3$ the rotations have order $3$ and the reflections order $2$; in $(\mathbb Z,+)$ every nonzero element has infinite order.

## Subgroups

**Definition (subgroup).** A subset $H\subset G$ is a *subgroup*, written $H\le G$, if $H$ is itself a group under the operation of $G$. The *trivial* subgroup is $\{e\}$; a subgroup $H\neq G$ is *proper* (Section 3.3).

**Example.** $\mathbb Q^*\le\mathbb R^*$ under multiplication (Example 3.3.1). $\{1,-1,i,-i\}\le\mathbb C^*$ (Example 3.3.2). The *special linear group* $SL_2(\mathbb R)=\{A:\det A=1\}$ is a subgroup of $GL_2(\mathbb R)$, because $\det(AB)=\det A\det B$ and $\det(A^{-1})=(\det A)^{-1}$ (Example 3.3.3).

**Warning.** "Under the operation of $G$" is not decoration. $GL_2(\mathbb R)$ is a group under multiplication, and it is a subset of the group $(M_2(\mathbb R),+)$ of all $2\times2$ matrices under addition, yet it is not a subgroup of the latter: it is not even closed under addition, since $A+(-A)=0$ is not invertible (Example 3.3.4). Exercise 3 asks you to explain this in your own words.

**Proposition (subgroup test).** $H\subset G$ is a subgroup if and only if (1) $e\in H$, (2) $h_1h_2\in H$ whenever $h_1,h_2\in H$, and (3) $h^{-1}\in H$ whenever $h\in H$ (Proposition 3.3.7).

**Proof.** If $H$ is a subgroup it is closed, so (2) holds. Its identity $e_H$ satisfies $e_He_H=e_H=e_He$ in $G$, so cancellation gives $e_H=e$ and (1) holds. The inverse of $h$ in $H$ is an inverse of $h$ in $G$, hence equals $h^{-1}$ by uniqueness, so (3) holds. Conversely, (1)–(3) give closure, an identity and inverses, and associativity is inherited from $G$. $\square$

**Proposition (one-step test).** A nonempty $H\subset G$ is a subgroup if and only if $gh^{-1}\in H$ for all $g,h\in H$ (Proposition 3.3.8).

**Proof.** Necessity is clear from the previous test. For sufficiency pick $h\in H$; then $e=hh^{-1}\in H$, so $h^{-1}=eh^{-1}\in H$ for every $h\in H$, and then $gh=g(h^{-1})^{-1}\in H$. $\square$

Remark. For a *finite* nonempty subset, closure alone suffices: if $h\in H$ then $h,h^2,h^3,\dots$ all lie in $H$, so $h^i=h^j$ for some $i<j$, whence $h^{j-i}=e\in H$ and $h^{j-i-1}=h^{-1}\in H$ (read $h^0=e$ if $j-i=1$). For infinite subsets this fails: $\mathbb N\subset\mathbb Z$ is closed under addition and is not a subgroup. Exercise 2 uses both facts.

**Example (structure, not size).** $\mathbb Z_4$ and $\mathbb Z_2\times\mathbb Z_2$ (pairs added componentwise mod $2$) both have order $4$. In $\mathbb Z_4$ the subgroups are $\{0\}$, $\{0,2\}$ and $\mathbb Z_4$; in $\mathbb Z_2\times\mathbb Z_2$ there are three subgroups of order $2$, one for each nonzero element (Example 3.3.5). So the two groups cannot be "the same up to renaming". Unit 5 makes this precise with the notion of isomorphism; for now, the list of subgroups and their orders is your first invariant, and in unit 2 the groups $\mathbb Z_4$ and $U(8)$ will be told apart the same way.

## What to carry forward

A group is a set with one associative operation, an identity and inverses; check closure first and name the failing axiom in a non-example. Identity and inverses are unique and cancellation holds because inverses exist. A subgroup is a subset that is a group under the *same* operation, verified by the subgroup tests; subgroup structure distinguishes groups of the same order. Next unit: the subgroups generated by a single element, their orders, and the roots of unity.
