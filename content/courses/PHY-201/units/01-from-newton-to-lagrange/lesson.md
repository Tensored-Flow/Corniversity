## Why a second formulation of mechanics

Newton's second law, $\mathbf F = m\ddot{\mathbf r}$, is a vector equation in an inertial frame. Two things make it awkward in practice. First, the moment we leave Cartesian coordinates the simple form breaks: in plane polar coordinates $\mathbf r = r\hat{\mathbf r}$ one finds (8.09 notes, Chapter 1, Eqs. 1.1–1.2)
$$\ddot{\mathbf r} = (\ddot r - r\dot\theta^2)\,\hat{\mathbf r} + (r\ddot\theta + 2\dot r\dot\theta)\,\hat{\boldsymbol\theta},$$
so the radial component of $\mathbf F = m\ddot{\mathbf r}$ is $F_r = m(\ddot r - r\dot\theta^2)$, *not* $m\ddot r$. The notes call polar coordinates "non-inertial coordinates" for exactly this reason. Second, constrained systems (a bead on a wire, a pendulum bob) need the constraint forces, which are usually unknown until the motion is known.

Lagrangian mechanics removes both difficulties at once. Its price is a change of question: instead of asking what the force is at each instant, we ask which whole path between fixed endpoints makes a certain number stationary.

**Conventions.** SI units throughout; generalized coordinates $q_i$, $i=1,\dots,N$; a dot is $d/dt$. The Lagrangian has units of energy (joules); the action has units of $\mathrm{J\,s}$.

## Generalized coordinates and the Lagrangian

**Definition (generalized coordinates).** Any set of $N$ independent real variables $q = (q_1,\dots,q_N)$ that fixes the configuration of the system. For a particle in the plane, $(x,y)$ or $(r,\theta)$; for a bead on a helix, a single coordinate $z$; for a pendulum hanging from a sliding support, $(x,\theta)$ (the notes' Figures 1.2–1.3).

**Definition (Lagrangian).** A function $L(q,\dot q,t)$ (Eq. 1.3). In the cases we meet first, $L = T - V$ with $T$ the kinetic energy and $V$ the potential energy; the notes allow the more general dependence $T=T(q,\dot q,t)$, $V=V(q,\dot q,t)$, and warn that even this does not cover every mechanical problem (friction is the standard exception; unit 2 returns to it).

**Definition (action; Hamilton's principle).** For a path $q(t)$ on $[t_1,t_2]$ with fixed endpoints, the action is $S[q]=\int_{t_1}^{t_2}L(q,\dot q,t)\,dt$. Hamilton's principle (Eq. 1.5) states that the physical motion makes $S$ stationary: $\delta S = 0$ for every variation $\delta q$ that vanishes at $t_1$ and $t_2$.

The word is *stationary*, not minimal. For a harmonic oscillator followed for more than half a period the physical path is a saddle of $S$; nothing in the derivation below uses minimality.

## From the principle to the equations of motion

**Theorem (Euler–Lagrange equations).** If $q_i$ are independent coordinates and $\delta S=0$ for all variations vanishing at the endpoints, then for each $i$
$$\frac{d}{dt}\frac{\partial L}{\partial \dot q_i} - \frac{\partial L}{\partial q_i} = 0 \qquad (\text{Eq. 1.4}).$$

**Derivation.** This is the calculus of variations of Section 1.5 (Eqs. 1.76–1.78) with $f=L$ and $s=t$. Vary the path, $q_i \to q_i + \delta q_i$, with $\delta q_i(t_1)=\delta q_i(t_2)=0$. Because the variation is taken at fixed time, $\delta\dot q_i = \frac{d}{dt}\delta q_i$. To first order,
$$\delta S = \int_{t_1}^{t_2}\sum_i\Big(\frac{\partial L}{\partial q_i}\,\delta q_i + \frac{\partial L}{\partial \dot q_i}\,\frac{d}{dt}\delta q_i\Big)dt .$$
Integrate the second term by parts:
$$\int_{t_1}^{t_2}\frac{\partial L}{\partial \dot q_i}\frac{d}{dt}\delta q_i\,dt = \Big[\frac{\partial L}{\partial \dot q_i}\delta q_i\Big]_{t_1}^{t_2} - \int_{t_1}^{t_2}\frac{d}{dt}\Big(\frac{\partial L}{\partial \dot q_i}\Big)\delta q_i\,dt,$$
and the boundary term vanishes because $\delta q_i$ does at both ends. Hence
$$\delta S = \int_{t_1}^{t_2}\sum_i\Big(\frac{\partial L}{\partial q_i}-\frac{d}{dt}\frac{\partial L}{\partial \dot q_i}\Big)\delta q_i\,dt = 0 .$$
If the $\delta q_i$ are independent and arbitrary (this is where independence of the coordinates is used: any holonomic constraints must already have been eliminated), the bracket must vanish for each $i$. $\square$

Each bracket has the units of a generalized force: for a Cartesian coordinate, newtons; for an angle, newton-metres. Check this habitually.

**Example (Newton recovered).** For one particle with $L=\tfrac12 m\dot{\mathbf r}^2 - V(\mathbf r)$ in Cartesian coordinates, $\partial L/\partial \dot x = m\dot x$ and $\partial L/\partial x = -\partial V/\partial x$, so the Euler–Lagrange equation is $m\ddot x = -\partial V/\partial x$: Newton's second law for a conservative force.

## The payoff: any coordinates will do

**Result (covariance under point transformations).** Let $Q_i = Q_i(q_1,\dots,q_N,t)$ be an invertible change of coordinates (a *point transformation*, Eq. 1.6) and define $L'(Q,\dot Q,t)=L(q,\dot q,t)$ (Eq. 1.7). Then $q(t)$ satisfies the Euler–Lagrange equations for $L$ if and only if $Q(t)$ satisfies them for $L'$ (Eq. 1.8).

**Derivation** (one degree of freedom; the general case only adds indices). From $\dot Q = \frac{\partial Q}{\partial q}\dot q + \frac{\partial Q}{\partial t}$ (Eq. 1.9) we read off two identities that will be used again and again in this course:
$$\frac{\partial \dot Q}{\partial \dot q} = \frac{\partial Q}{\partial q}\quad(\text{Eq. 1.10}),\qquad \frac{d}{dt}\frac{\partial Q}{\partial q} = \frac{\partial \dot Q}{\partial q}.$$
(The second follows by computing both sides: each equals $\frac{\partial^2 Q}{\partial q^2}\dot q+\frac{\partial^2 Q}{\partial q\,\partial t}$.) By the chain rule, $\frac{\partial L}{\partial \dot q} = \frac{\partial L'}{\partial \dot Q}\frac{\partial Q}{\partial q}$ and $\frac{\partial L}{\partial q} = \frac{\partial L'}{\partial Q}\frac{\partial Q}{\partial q} + \frac{\partial L'}{\partial \dot Q}\frac{\partial \dot Q}{\partial q}$. Therefore
$$\frac{d}{dt}\frac{\partial L}{\partial \dot q}-\frac{\partial L}{\partial q} = \Big(\frac{d}{dt}\frac{\partial L'}{\partial \dot Q}-\frac{\partial L'}{\partial Q}\Big)\frac{\partial Q}{\partial q} + \frac{\partial L'}{\partial \dot Q}\Big(\frac{d}{dt}\frac{\partial Q}{\partial q}-\frac{\partial \dot Q}{\partial q}\Big),$$
and the last bracket is zero by the second identity. Since $\partial Q/\partial q\neq 0$ for an invertible transformation, the two Euler–Lagrange expressions vanish together (Eqs. 1.12–1.13). $\square$

There is a one-line conceptual proof as well: the action is a number attached to a path, independent of how the path is labelled, so its stationary paths cannot depend on the labelling. The computation above is worth doing once because the two identities recur in unit 2 and unit 8.

Two consequences the notes draw out: we may freely use the Euler–Lagrange equations in "non-inertial coordinates" such as polar coordinates, and we may write $L$ in whatever coordinates are easiest and then change to ones adapted to the symmetry of the problem.

## Worked examples

**Example (plane polar coordinates, Eqs. 1.14–1.18).** For a particle of mass $m$ in a potential $V(r,\theta)$, $\dot{\mathbf r} = \dot r\hat{\mathbf r} + r\dot\theta\hat{\boldsymbol\theta}$ gives
$$L = \tfrac12 m(\dot r^2 + r^2\dot\theta^2) - V(r,\theta).$$
The $r$ equation: $\frac{d}{dt}(m\dot r) - m r\dot\theta^2 + \frac{\partial V}{\partial r} = 0$, i.e. $m\ddot r - m r\dot\theta^2 = -\partial V/\partial r = F_r$. The centripetal term that made Newton's law awkward has appeared by itself. The $\theta$ equation: $\frac{d}{dt}(m r^2\dot\theta) = -\partial V/\partial\theta$, which says that the rate of change of angular momentum $L_z = m r^2\dot\theta$ equals the torque $\tau_z = -\partial V/\partial\theta$. Units: $m r^2\dot\theta$ is $\mathrm{kg\,m^2\,s^{-1}}$, its time derivative $\mathrm{kg\,m^2\,s^{-2}} = \mathrm{N\,m}$, and $\partial V/\partial\theta$ is joules per radian, also $\mathrm{N\,m}$.

**Example (particle in a frictionless cone, Eqs. 1.19–1.23).** A particle slides under gravity inside a cone of half-angle $\alpha$ with axis vertical, $\tan\alpha = \sqrt{x^2+y^2}/z$. The notes' four-step method: (1) write $T$ and $V$ in cylindrical coordinates, $T=\tfrac12 m(\dot r^2 + r^2\dot\theta^2+\dot z^2)$, $V = mgz$; (2) eliminate the constrained coordinate, $z = r\cot\alpha$, $\dot z = \dot r\cot\alpha$, leaving
$$L = \tfrac12 m\big[(1+\cot^2\alpha)\dot r^2 + r^2\dot\theta^2\big] - mgr\cot\alpha ;$$
(3) write the Euler–Lagrange equations, $(1+\cot^2\alpha)\ddot r - r\dot\theta^2 + g\cot\alpha = 0$ and $\frac{d}{dt}(m r^2\dot\theta)=0$; (4) solve, or extract what is wanted. Note $1+\cot^2\alpha = 1/\sin^2\alpha$. Limiting case: as $\alpha\to\pi/2$ the cone flattens into a horizontal plane, $\cot\alpha\to 0$, and the Lagrangian becomes that of a free particle in the plane, as it must, since gravity then does no work. The $\theta$ equation says $m r^2\dot\theta$ is constant: a conservation law has dropped out of a coordinate that does not appear in $L$. Unit 2 makes that systematic.

Notice what did *not* happen: the normal force from the cone was never written down. The constraint was absorbed by the choice of coordinates. Unit 2 shows how to recover such forces when they are wanted.

## Assumptions, and what is left open

- Forces derivable from a potential. If $V$ depends on $\dot q$ (a "generalized potential"), the formalism still works; the notes' example in Section 1.3 is a charge in an electromagnetic field, $L=\tfrac12 m\dot{\mathbf r}^2 - e\phi + e\mathbf A\cdot\dot{\mathbf r}$, for which the canonical momentum $\partial L/\partial\dot{\mathbf r} = m\dot{\mathbf r}+e\mathbf A$ is not the kinetic momentum.
- Constraints absorbed by coordinates must be holonomic and must do no work under virtual displacements (frictionless). Rolling without slipping and friction need the machinery of unit 2.
- Independence of the $\delta q_i$. Using the Euler–Lagrange equations with coordinates that are still related by a constraint is the commonest error in this subject.

**Warning.** $L$ is not unique. Adding the total time derivative of any $F(q,t)$, or multiplying by a nonzero constant, changes $S$ by a boundary term or a factor and leaves the equations of motion unchanged. Exercise 2 asks you to prove this and to decide which other alterations are harmless. The habit to form: a Lagrangian is a generator of equations, not a physical quantity in itself.

**Warning.** "$L = T - V$" is a recipe that happens to reproduce Newton for conservative forces; it is Hamilton's principle, not the recipe, that is fundamental. When the recipe fails (dissipation, velocity-dependent forces that are not derivable from a generalized potential) the principle is modified, not abandoned.

## A first look ahead

Define the canonical momentum $p_i = \partial L/\partial\dot q_i$ (Section 1.2, Hamiltonian Mechanics). The Euler–Lagrange equations then read $\dot p_i = \partial L/\partial q_i$, and the Legendre transform $H = \sum_i p_i\dot q_i - L$ (Eq. 1.24) produces Hamilton's equations (Eq. 1.25). Unit 7 develops this; for now only the definition of $p_i$ is needed, because it is what the symmetries of unit 2 conserve.

## What to carry forward

A path, not an instant, is the object of study. The Euler–Lagrange equations follow from stationarity of the action by one integration by parts, hold in any coordinates, and absorb holonomic constraints through the choice of coordinates. Check every equation of motion by its units and by a limiting case in which you already know the answer.
