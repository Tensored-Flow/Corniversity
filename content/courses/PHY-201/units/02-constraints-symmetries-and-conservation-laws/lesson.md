## Two promises to keep

Unit 1 made two promises: that constraints could be handled without first knowing the forces that enforce them, and that a coordinate missing from $L$ signals a conservation law. This unit keeps both, and adds the tool for the cases where you *do* want the constraint force.

**Conventions.** SI units; generalized coordinates $q_j$, $j=1,\dots,n$; canonical momenta $p_j = \partial L/\partial\dot q_j$; summation over a repeated Greek index $\alpha$ labels constraints, $\alpha = 1,\dots,k$.

## Kinds of constraint

**Definition (holonomic constraint).** A relation $f(q_1,\dots,q_n,t)=0$ among the coordinates, possibly time dependent (8.09 notes, Eq. 1.60). The cone of unit 1, $z - r\cot\alpha = 0$, is one. Each holonomic constraint lets us eliminate one coordinate.

**Definition (non-holonomic constraint).** Anything else: an inequality such as $r^2 - a^2 \ge 0$ for a particle outside a sphere, or a condition on velocities such as rolling without slipping. The notes (Eq. 1.61) single out the *semi-holonomic* (Pfaffian) form
$$\sum_j a_j(q,t)\,dq_j + a_t(q,t)\,dt = 0 ,$$
which includes every rolling constraint.

A semi-holonomic constraint may be holonomic in disguise. If $f(q,t)=0$ then $df = \sum_j \frac{\partial f}{\partial q_j}dq_j + \frac{\partial f}{\partial t}dt = 0$ (Eq. 1.62), so $a_j = \partial f/\partial q_j$, $a_t = \partial f/\partial t$ and the coefficients satisfy the integrability conditions (Eq. 1.63)
$$\frac{\partial a_j}{\partial q_i} = \frac{\partial a_i}{\partial q_j},\qquad \frac{\partial a_j}{\partial t} = \frac{\partial a_t}{\partial q_j},$$
possibly after multiplying the whole constraint by an integrating factor $h(q,t)$. The notes' one-dimensional example makes the point: a disc of radius $a$ rolling down a line has $\dot x = a\dot\phi$, which integrates to $x = a\phi + x_0$, holonomic. A vertical disc free to roll on a *plane*, with heading angle $\theta$, obeys $dx - a\sin\theta\,d\phi = 0$ and $dy + a\cos\theta\,d\phi = 0$. Try to make the first one exact: we would need $f$ with $f_x = h$, $f_\theta = 0$, $f_\phi = -ah\sin\theta$; then $\partial f_\phi/\partial\theta = -ah\cos\theta$ must equal $\partial f_\theta/\partial\phi = 0$, forcing $h = 0$. No integrating factor exists: the constraint is genuinely non-holonomic (the notes carry out this check on PDF page 18). The disc can reach any $(x,y,\theta,\phi)$ by a suitable path, yet its velocities are restricted at every instant.

## Virtual work and D'Alembert's principle

**Definition (virtual displacement).** An infinitesimal change $\delta\mathbf r_i$ of the configuration, consistent with the constraints, carried out at *fixed time* (PDF page 18). For a bead on a wire moving upward with speed $v_0$, $\delta\mathbf r$ is along the wire, while the real displacement $d\mathbf r$ in time $dt$ also has a component $v_0\,dt$ upward.

For the constraints of mechanics — smooth surfaces, rigid rods, rolling without slipping — the constraint forces $\mathbf Z_i$ do no virtual work: $\sum_i\mathbf Z_i\cdot\delta\mathbf r_i = 0$. (Friction that slides does work and is excluded; friction that merely prevents slipping acts at a point of zero virtual displacement and is included.) Writing Newton's law as $\dot{\mathbf p}_i = \mathbf F_i + \mathbf Z_i$ with $\mathbf F_i$ the applied forces and taking the virtual work gives

**Result (D'Alembert's principle).** $\displaystyle\sum_i(\dot{\mathbf p}_i - \mathbf F_i)\cdot\delta\mathbf r_i = 0$ for every virtual displacement (Eq. 1.64).

**Derivation (from D'Alembert to Lagrange).** Let $\mathbf r_i = \mathbf r_i(q,t)$, so $\delta\mathbf r_i = \sum_j\frac{\partial\mathbf r_i}{\partial q_j}\delta q_j$ at fixed time. The applied-force term defines the generalized force $Q_j = \sum_i\mathbf F_i\cdot\partial\mathbf r_i/\partial q_j$. For the inertial term, the two identities of unit 1 in vector form, $\partial\dot{\mathbf r}_i/\partial\dot q_j = \partial\mathbf r_i/\partial q_j$ and $\frac{d}{dt}\big(\partial\mathbf r_i/\partial q_j\big) = \partial\dot{\mathbf r}_i/\partial q_j$, give
$$\sum_i m_i\ddot{\mathbf r}_i\cdot\frac{\partial\mathbf r_i}{\partial q_j} = \frac{d}{dt}\Big(\sum_i m_i\dot{\mathbf r}_i\cdot\frac{\partial\dot{\mathbf r}_i}{\partial\dot q_j}\Big) - \sum_i m_i\dot{\mathbf r}_i\cdot\frac{\partial\dot{\mathbf r}_i}{\partial q_j} = \frac{d}{dt}\frac{\partial T}{\partial\dot q_j} - \frac{\partial T}{\partial q_j}.$$
D'Alembert's principle becomes $\sum_j\big[\frac{d}{dt}\frac{\partial T}{\partial\dot q_j} - \frac{\partial T}{\partial q_j} - Q_j\big]\delta q_j = 0$. If the $q_j$ are independent, each bracket vanishes. When $Q_j = -\partial V/\partial q_j$ this is the Euler–Lagrange equation for $L = T - V$; otherwise the non-potential part of $Q_j$ stays on the right-hand side. This is how friction and drag enter the formalism, and it is the "differential" form of Hamilton's principle that the notes contrast with the integrated form (Eqs. 1.83–1.84). $\square$

## Lagrange multipliers: keeping the constraint and getting the force

Suppose we keep $n$ coordinates related by $k$ constraints $g_\alpha = \sum_j a_{j\alpha}(q,t)\dot q_j + a_{t\alpha}(q,t) = 0$ (Eq. 1.85), either because they are semi-holonomic and cannot be eliminated, or because we want the constraint forces. Virtual displacements obey $\sum_j a_{j\alpha}\delta q_j = 0$ (Eq. 1.86), so the $\delta q_j$ are no longer independent.

**Theorem (Lagrange multipliers).** There exist functions $\lambda_\alpha(t)$ such that
$$\frac{d}{dt}\frac{\partial L}{\partial\dot q_j} - \frac{\partial L}{\partial q_j} = \sum_\alpha\lambda_\alpha a_{j\alpha},\qquad j = 1,\dots,n \quad(\text{Eq. 1.88}),$$
and these $n$ equations together with the $k$ constraints $g_\alpha = 0$ determine the $n+k$ unknowns $q_j(t),\lambda_\alpha(t)$. The right-hand side is the generalized constraint force $Q^{c}_j$.

**Derivation.** Multiply each constraint on virtual displacements by an as yet unknown $\lambda_\alpha$ and add the sum (which is zero) to D'Alembert's principle: $\sum_j\big[\text{EL}_j - \sum_\alpha\lambda_\alpha a_{j\alpha}\big]\delta q_j = 0$, where $\text{EL}_j$ is the Euler–Lagrange expression (Eq. 1.87). Only $n-k$ of the $\delta q_j$ are independent; for the other $k$ choose the $k$ multipliers so that those brackets vanish identically. The remaining brackets multiply independent variations and so vanish too. $\square$

For holonomic constraints $f_\alpha(q,t) = 0$ written in differential form, $a_{j\alpha} = \partial f_\alpha/\partial q_j$ and the right-hand side is $\sum_\alpha\lambda_\alpha\partial f_\alpha/\partial q_j$ (Eq. 1.89); the same equations follow from varying the augmented action $\int(L + \lambda_\alpha f_\alpha)\,dt$ with the $\lambda_\alpha$ treated as extra coordinates (Eq. 1.90). The notes' interpretation: $-\lambda_\alpha f_\alpha$ acts as an extra potential whose gradient $\lambda_\alpha\nabla_q f_\alpha$ is normal to the constraint surface — the normal force.

**Example (leaving a sphere).** A particle starts at rest at the top of a fixed frictionless sphere of radius $R$ and is nudged. Use polar coordinates $(r,\theta)$ from the centre with $\theta$ measured from the upward vertical, keep both, and impose $f = r - R = 0$ with a multiplier. $L = \tfrac12 m(\dot r^2 + r^2\dot\theta^2) - mgr\cos\theta$. The $r$ equation: $m\ddot r - mr\dot\theta^2 + mg\cos\theta = \lambda\cdot 1$; the $\theta$ equation: $\frac{d}{dt}(mr^2\dot\theta) - mgr\sin\theta = \lambda\cdot 0$. Now set $r = R$: $\lambda = mg\cos\theta - mR\dot\theta^2$, which is the outward normal force. Multiplying the $\theta$ equation by $\dot\theta$ gives $\frac{d}{dt}\big(\tfrac12 mR^2\dot\theta^2 + mgR\cos\theta\big) = 0$, so with the initial condition $R\dot\theta^2 = 2g(1-\cos\theta)$ and
$$\lambda = mg(3\cos\theta - 2).$$
At $\theta = 0$, $\lambda = mg$: the sphere supports the weight. The particle leaves when $\lambda = 0$, at $\cos\theta = 2/3$, independent of $m$, $g$ and $R$. Units: every term in $\lambda$ is a force. Had we eliminated $r$ at the start we would have found the motion but never the normal force or the departure point.

## Symmetries and conservation laws

**Definition (cyclic coordinate).** A coordinate $q_j$ that does not appear in $L$ (equivalently in $H$; PDF page 12).

**Theorem.** If $q_j$ is cyclic, $p_j = \partial L/\partial\dot q_j$ is conserved. **Proof.** $\dot p_j = \partial L/\partial q_j = 0$. $\square$

The notes' examples (Section 1.3): if $V$ is independent of the centre-of-mass position $\mathbf R$, then $T$ splits into centre-of-mass and relative parts (Eq. 1.49) and $\mathbf P = M\dot{\mathbf R}$ is conserved; if $L$ is invariant under rotation by an angle $\varphi$ about an axis $\hat{\mathbf n}$, then $p_\varphi = \hat{\mathbf n}\cdot\mathbf L_{\rm total}$ is conserved (Eq. 1.52); for a charge in electromagnetic fields with $L = \tfrac12 m\dot{\mathbf r}^2 - e\phi + e\mathbf A\cdot\dot{\mathbf r}$ and $\phi,\mathbf A$ independent of $x$, the conserved quantity is the *canonical* momentum $p_x = m\dot x + eA_x$, not the kinetic one (PDF page 14).

Cyclic coordinates are the special case of a general statement.

**Theorem (Noether).** Suppose the infinitesimal transformation $q_i\to q_i + \epsilon K_i(q)$ leaves $L$ unchanged to first order in $\epsilon$. Then $Q = \sum_i p_iK_i$ is conserved along solutions.

**Derivation.** Invariance means $0 = \frac{\delta L}{\epsilon} = \sum_i\Big(\frac{\partial L}{\partial q_i}K_i + \frac{\partial L}{\partial\dot q_i}\dot K_i\Big)$, where $\dot K_i = \sum_l\frac{\partial K_i}{\partial q_l}\dot q_l$ is the induced change of $\dot q_i$. On a solution, $\partial L/\partial q_i = \dot p_i$, so the right-hand side is $\sum_i(\dot p_iK_i + p_i\dot K_i) = \frac{d}{dt}\sum_ip_iK_i$. $\square$ If $L$ changes by a total derivative, $\delta L = \epsilon\,d\Lambda/dt$, the same computation gives the conserved quantity $\sum_ip_iK_i - \Lambda$. A cyclic coordinate is the case $K = e_j$. This is the form of the theorem in Tong's Section 2.4.1 and the one exercise 2 uses.

## Energy, and the Hamiltonian that need not be the energy

**Result.** With $H = \sum_jp_j\dot q_j - L$, along solutions $\dfrac{dH}{dt} = -\dfrac{\partial L}{\partial t}$ (Eq. 1.55). Hence $H$ is conserved whenever $L$ has no explicit time dependence.

**Derivation.** $\frac{dL}{dt} = \sum_j\big(\frac{\partial L}{\partial q_j}\dot q_j + \frac{\partial L}{\partial\dot q_j}\ddot q_j\big) + \frac{\partial L}{\partial t} = \sum_j(\dot p_j\dot q_j + p_j\ddot q_j) + \frac{\partial L}{\partial t} = \frac{d}{dt}\sum_jp_j\dot q_j + \frac{\partial L}{\partial t}$. Rearrange. $\square$

**Result (when $H$ is the energy).** If $T = \tfrac12\sum_{jk}T_{jk}(q)\dot q_j\dot q_k$ is homogeneous of degree two in the velocities and $V = V(q)$, then $\sum_j\dot q_j\partial T/\partial\dot q_j = 2T$ (Euler's theorem on homogeneous functions) and $H = 2T - (T - V) = T + V = E$ (Eqs. 1.30–1.31). Both hypotheses are used: a time-dependent change of coordinates introduces terms in $T$ of degree one and zero in $\dot q$, and a velocity-dependent potential spoils the second step.

**Example (spring on a moving cart, Eqs. 1.56–1.59).** A mass $m$ is attached by a spring of constant $k$ to a cart that moves at constant speed $v_0$. With $x$ the displacement from a fixed wall, $L = \tfrac12m\dot x^2 - \tfrac12k(x - v_0t)^2$, which satisfies both hypotheses, so $H = E = p^2/2m + \tfrac12k(x-v_0t)^2$ — but $\partial L/\partial t\neq 0$, so neither is conserved (whatever pulls the cart does work on the system). With $x' = x - v_0t$ instead, $L' = \tfrac12m\dot x'^2 + mv_0\dot x' + \tfrac12mv_0^2 - \tfrac12kx'^2$, $p' = m\dot x' + mv_0 = p$, and
$$H' = \frac{(p' - mv_0)^2}{2m} + \tfrac12kx'^2 - \tfrac12mv_0^2 ,$$
which is conserved (no explicit $t$) but is not the energy $E$: it is the energy measured on the cart, shifted by a constant. The two coordinates describe the same motion and both statements are true. "The Hamiltonian is the energy" is a theorem with hypotheses, not a definition.

**Warning.** Noether's theorem needs a *continuous* family of symmetries; a reflection symmetry yields no conservation law in classical mechanics. **Warning.** Inequality constraints are outside the multiplier method; they are handled by solving the unconstrained problem and checking when the constraint force would have to change sign, as the sphere example did.

## What to carry forward

Classify every constraint before choosing coordinates: holonomic ones can be eliminated, semi-holonomic ones cannot, and the integrability test decides which is which. Multipliers return the constraint forces. Every continuous symmetry of $L$ gives a conserved quantity, and the absence of explicit time dependence gives a conserved $H$, which equals the energy only under stated hypotheses. Unit 3 uses all of this on the central-force problem.
