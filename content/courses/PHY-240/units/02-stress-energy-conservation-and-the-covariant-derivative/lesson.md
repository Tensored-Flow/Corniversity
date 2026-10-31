## Still flat, but no longer rectilinear

This unit does two things that Lectures 4–5 of 8.962 do together. It introduces the tensor that will source gravity — the stress-energy tensor $T^{\mu\nu}$ — and its conservation law, and it discovers that even in flat spacetime the partial derivative fails to be a tensor operation as soon as the coordinates are curvilinear. The repair, the covariant derivative with its Christoffel symbols, is built here on the flat plane, where everything can be checked against elementary vector calculus. Curvature is still absent: we say so because the next unit will have to say the opposite.

**Conventions.** Signature $(-,+,+,+)$; $c = 1$ with units restored where stated; indices as in unit 1. A general metric is written $g_{\mu\nu}$ even when it is $\eta$ in disguise.

## Volume elements and electrodynamics, briefly

Lecture 4 constructs volume elements covariantly with the Levi-Civita tensor $\epsilon_{\alpha\beta\gamma\delta}$ (totally antisymmetric, $\epsilon_{0123} = +1$ in right-handed inertial coordinates; the Guide's footnote warns that it is a tensor only for inertial coordinates in special relativity — unit 4 fixes this with $\sqrt{|g|}$). Its use here is Gauss's theorem: for any 4-vector $J^\mu$, $\int_V\partial_\mu J^\mu\,d^4x = \oint_{\partial V}J^\mu\,d\Sigma_\mu$, which turns the differential conservation law $\partial_\mu J^\mu = 0$ into "what flows into a region equals what flows out plus what accumulates".

Electrodynamics is the model theory. The 4-current $J^\mu = (\rho,\mathbf J)$ and the Faraday tensor $F_{\mu\nu} = \partial_\mu A_\nu - \partial_\nu A_\mu$ (a tensor even under general coordinate changes, by exercise 2 of unit 1) carry Maxwell's equations as $\partial_\mu F^{\mu\nu}\propto J^\nu$ and $\partial_{[\alpha}F_{\beta\gamma]} = 0$, with the constant depending on the unit system. Antisymmetry of $F$ gives charge conservation $\partial_\nu J^\nu = 0$ for free.

## The stress-energy tensor

**Definition (stress-energy tensor).** $T^{\mu\nu}$ is the flux of $\mu$-momentum across a surface of constant $x^\nu$ (Lecture 4). Read in an inertial frame: $T^{00}$ is the energy density; $T^{0i} = T^{i0}$ is the energy flux through a surface of constant $x^i$, equivalently the density of $i$-momentum; $T^{ij}$ is the flux of $i$-momentum across a surface of constant $x^j$ — the stress, whose isotropic part is pressure. Units with $c$: every component has the units of energy density, $\mathrm{J\,m^{-3}} = \mathrm{Pa}$.

**Result (symmetry).** $T^{\mu\nu} = T^{\nu\mu}$ (Lecture 5). The equality $T^{0i} = T^{i0}$ is mass–energy equivalence: an energy flux is a momentum density (with $c$: energy flux $= c^2\times$ momentum density). The equality $T^{ij} = T^{ji}$ follows from conservation of angular momentum: an antisymmetric stress on a small cube would produce a torque proportional to its volume acting on a moment of inertia proportional to the fifth power of its side, hence an unbounded angular acceleration as the cube shrinks.

**Example (dust).** A cloud of non-interacting particles of mass $m$, rest-frame number density $n$, 4-velocity $u^\mu$: each particle carries $p^\mu = mu^\mu$ and the number flux is $N^\mu = nu^\mu$, so the flux of $\mu$-momentum across constant-$x^\nu$ surfaces is
$$T^{\mu\nu}_{\rm dust} = p^\mu N^\nu = \rho\,u^\mu u^\nu,\qquad \rho \equiv mn .$$
In a frame where the dust moves at $\mathbf v$, $T^{00} = \gamma^2\rho$: one $\gamma$ because each particle's energy is $\gamma m$, one because the density is $\gamma n$.

**Example (perfect fluid).** In its rest frame a perfect fluid is isotropic with energy density $\rho$ and pressure $P$: $T^{\mu\nu} = \mathrm{diag}(\rho,P,P,P)$. The unique symmetric tensor built from $u^\mu$ and $\eta^{\mu\nu}$ with these rest-frame components is
$$T^{\mu\nu} = (\rho + P)\,u^\mu u^\nu + P\,\eta^{\mu\nu}.$$
Check in the rest frame, $u^\mu = (1,\mathbf 0)$: $T^{00} = (\rho+P) - P = \rho$, $T^{ij} = P\delta^{ij}$, $T^{0i} = 0$. Dust is the case $P = 0$. With $c$ restored and $\rho$ an energy density, $T^{\mu\nu} = (\rho+P)u^\mu u^\nu/c^2 + P\eta^{\mu\nu}$; $\rho$ and $P$ share the unit pascal, so the combination $\rho + P$ is dimensionally honest. (Lecture 4 presents the perfect fluid as "a particularly important example"; it is the source for every cosmological and stellar model later in the course.)

## Conservation and its Newtonian limit

**Result (local conservation).** $\partial_\mu T^{\mu\nu} = 0$: four equations, $\nu = 0$ for energy and $\nu = i$ for momentum (Lecture 5).

**Derivation (Newtonian fluid equations).** For the perfect fluid with $u^\mu = \gamma(1,\mathbf v)$:
$$\nu = 0:\quad \partial_t\big[(\rho+P)\gamma^2 - P\big] + \partial_i\big[(\rho+P)\gamma^2v^i\big] = 0,$$
$$\nu = j:\quad \partial_t\big[(\rho+P)\gamma^2v^j\big] + \partial_i\big[(\rho+P)\gamma^2v^iv^j + P\delta^{ij}\big] = 0 .$$
Now assume (i) $v\ll 1$, so $\gamma^2 = 1 + O(v^2)$, and (ii) $P\ll\rho$ (with $c$: $P\ll\rho c^2$, true for air, water and stars that are not neutron stars). Keeping leading orders, the $\nu = 0$ equation becomes the continuity equation $\partial_t\rho + \nabla\cdot(\rho\mathbf v) = 0$. The $\nu = j$ equation becomes $\partial_t(\rho v^j) + \partial_i(\rho v^iv^j) + \partial_jP = 0$; expanding and using continuity to cancel $v^j[\partial_t\rho + \partial_i(\rho v^i)]$ leaves Euler's equation
$$\rho\,(\partial_t\mathbf v + \mathbf v\cdot\nabla\mathbf v) = -\nabla P .$$
What was neglected: pressure as a source of inertia (the $P$ in $\rho + P$), and the $\gamma$ factors; both return for relativistic flows, where pressure gravitates and carries momentum. $\square$

## Curvilinear coordinates on a flat plane

Lecture 5 turns to "special relativity and tensor analysis in curvilinear coordinates". Take the Euclidean plane with polar coordinates, $x = r\cos\theta$, $y = r\sin\theta$. The coordinate basis vectors are
$$\mathbf e_r = \frac{\partial\mathbf x}{\partial r} = (\cos\theta,\sin\theta),\qquad \mathbf e_\theta = \frac{\partial\mathbf x}{\partial\theta} = (-r\sin\theta, r\cos\theta).$$
Note $|\mathbf e_\theta| = r$: as the Guide puts it, $\mathbf e_\phi$ must have the dimensions of length so that $\Delta\phi\,\mathbf e_\phi$ contributes a length to $\Delta\mathbf x$. The metric components are $g_{rr} = \mathbf e_r\cdot\mathbf e_r = 1$, $g_{\theta\theta} = r^2$, $g_{r\theta} = 0$: $ds^2 = dr^2 + r^2d\theta^2$, still the flat plane.

The basis vectors change from point to point. Differentiating,
$$\partial_r\mathbf e_r = 0,\quad \partial_\theta\mathbf e_r = (-\sin\theta,\cos\theta) = \tfrac1r\mathbf e_\theta,\quad \partial_r\mathbf e_\theta = (-\sin\theta,\cos\theta) = \tfrac1r\mathbf e_\theta,\quad \partial_\theta\mathbf e_\theta = (-r\cos\theta,-r\sin\theta) = -r\,\mathbf e_r .$$

**Definition (Christoffel symbols).** $\partial_\beta\mathbf e_\alpha = \Gamma^\mu{}_{\alpha\beta}\,\mathbf e_\mu$: the Christoffel symbol records how the basis changes, expressed in the basis itself (Lecture 5: "the quantity (not a tensor!) which relates derivatives of basis objects to basis objects"). For polar coordinates the non-zero ones are
$$\Gamma^\theta{}_{r\theta} = \Gamma^\theta{}_{\theta r} = \frac1r,\qquad \Gamma^r{}_{\theta\theta} = -r .$$
Units: $\Gamma^\theta{}_{r\theta}$ is a reciprocal length and $\Gamma^r{}_{\theta\theta}$ a length, because $\theta$ is dimensionless and $r$ is a length; the symbols need not share units.

## The covariant derivative

For a vector field $\mathbf V = V^\alpha\mathbf e_\alpha$, the honest derivative must differentiate both factors:
$$\partial_\beta\mathbf V = (\partial_\beta V^\alpha)\mathbf e_\alpha + V^\alpha\,\Gamma^\mu{}_{\alpha\beta}\mathbf e_\mu = \big(\partial_\beta V^\mu + \Gamma^\mu{}_{\alpha\beta}V^\alpha\big)\mathbf e_\mu .$$

**Definition (covariant derivative).** $\nabla_\beta V^\mu \equiv \partial_\beta V^\mu + \Gamma^\mu{}_{\alpha\beta}V^\alpha$ are the components of $\partial_\beta\mathbf V$; they transform as a $(1,1)$ tensor because $\partial_\beta\mathbf V$ is a geometric object. For a one-form, requiring the Leibniz rule on the scalar $p_\alpha V^\alpha$ gives $\nabla_\beta p_\alpha = \partial_\beta p_\alpha - \Gamma^\mu{}_{\alpha\beta}p_\mu$; a general tensor gets one $+\Gamma$ term per upper index and one $-\Gamma$ term per lower index. The inhomogeneous term in the transformation law of $\partial_\beta V^\mu$ (unit 1, exercise 2) is exactly cancelled by the inhomogeneous transformation of $\Gamma$, which is why neither is a tensor but their sum is.

**Theorem (metric compatibility and the Christoffel formula).** In Cartesian coordinates on flat space $\nabla = \partial$ and the metric components are constant, so $\nabla_\gamma g_{\alpha\beta} = 0$ there; being a tensor equation it holds in every coordinate system. Together with the symmetry $\Gamma^\mu{}_{\alpha\beta} = \Gamma^\mu{}_{\beta\alpha}$ of a coordinate basis ($\partial_\beta\mathbf e_\alpha = \partial_\beta\partial_\alpha\mathbf x = \partial_\alpha\mathbf e_\beta$), this determines
$$\Gamma^\mu{}_{\alpha\beta} = \tfrac12 g^{\mu\nu}\big(\partial_\alpha g_{\nu\beta} + \partial_\beta g_{\nu\alpha} - \partial_\nu g_{\alpha\beta}\big).$$
**Derivation.** Write out $\nabla_\gamma g_{\alpha\beta} = \partial_\gamma g_{\alpha\beta} - \Gamma^\mu{}_{\alpha\gamma}g_{\mu\beta} - \Gamma^\mu{}_{\beta\gamma}g_{\alpha\mu} = 0$ three times with the index triple cyclically permuted; add the first two and subtract the third; the symmetry of $\Gamma$ in its lower indices leaves $2\,g_{\mu\nu}\Gamma^\mu{}_{\alpha\beta}$ on one side, and raising with $g^{\mu\nu}$ finishes. $\square$ Check on the plane: $\Gamma^r{}_{\theta\theta} = \tfrac12g^{rr}(-\partial_rg_{\theta\theta}) = -\tfrac12\cdot2r = -r$; $\Gamma^\theta{}_{r\theta} = \tfrac12g^{\theta\theta}\partial_rg_{\theta\theta} = \tfrac12r^{-2}\cdot2r = 1/r$. $\checkmark$ The Guide notes that in general relativity the same requirement $\nabla g = 0$ is *imposed* by appeal to the equivalence principle ("I can find a local representation in which spacetime looks flat"); here, in flat space, it is a theorem.

**Example (divergence in polar coordinates).** $\nabla_\alpha V^\alpha = \partial_\alpha V^\alpha + \Gamma^\alpha{}_{\mu\alpha}V^\mu = \partial_rV^r + \partial_\theta V^\theta + \tfrac1rV^r = \tfrac1r\partial_r(rV^r) + \partial_\theta V^\theta$. In terms of the orthonormal component $V^{\hat\theta} = rV^\theta$ this is the familiar $\tfrac1r\partial_r(rV^r) + \tfrac1r\partial_\theta V^{\hat\theta}$ — the vector-calculus formula, derived rather than remembered. The general identity $\nabla_\alpha V^\alpha = |g|^{-1/2}\partial_\alpha(|g|^{1/2}V^\alpha)$, with $\sqrt{|g|} = r$ here, is proved in unit 4. Exercise 1 repeats the computation in spherical coordinates and recovers the Laplacian.

## Warnings

**Warning.** $\Gamma$ is not a tensor. It vanishes identically in Cartesian coordinates and not in polar coordinates on the *same* flat plane; a tensor that vanishes in one coordinate system vanishes in all. Its transformation law has an inhomogeneous term, and that is precisely what makes $\nabla$ work.

**Warning.** Nothing in this unit is curvature. The existence of Cartesian coordinates in which every $\Gamma$ vanishes everywhere is the statement that the plane, and Minkowski spacetime, are flat. Curvature will be the obstruction to finding such coordinates on more than a single point — the subject of units 3 and 5.

**Warning.** The Newtonian fluid limit used two separate approximations, $v\ll c$ and $P\ll\rho c^2$. Dropping only one of them gives a different, still relativistic, theory; name both every time.

## What to carry forward

$T^{\mu\nu}$ is symmetric, has the units of energy density, and for a perfect fluid is $(\rho+P)uu + P\eta$; $\partial_\mu T^{\mu\nu} = 0$ contains continuity and Euler in the Newtonian limit. In curvilinear coordinates the basis varies, $\Gamma$ records how, $\nabla_\beta V^\mu = \partial_\beta V^\mu + \Gamma^\mu{}_{\alpha\beta}V^\alpha$ is the tensorial derivative, $\nabla g = 0$ fixes $\Gamma$ from the metric, and all of it is still flat. Unit 3 asks what happens when free fall, not Cartesian coordinates, defines the local inertial frame.
