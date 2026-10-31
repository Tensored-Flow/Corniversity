## Where this course starts

General relativity will say that gravity is the curvature of spacetime. Before curvature can mean anything we need a language in which physical statements do not depend on the coordinates used to make them. This unit builds that language where it is cheapest to build — flat Minkowski spacetime, the setting of special relativity — following Lectures 1–3 of MIT 8.962 (Spring 2020). Nothing here is curved; the honesty of the course depends on saying so. Curvature first appears, labelled, in unit 3.

**Conventions.** Signature $(-,+,+,+)$: $\eta_{\mu\nu} = \mathrm{diag}(-1,+1,+1,+1)$, the convention of the 8.962 Lecture Guide, of Tong's *General Relativity* notes ("We use the metric with signature $(-+++)$") and of Carroll. Greek indices run over $0,1,2,3$, Latin over $1,2,3$; repeated upper–lower pairs are summed. Units: $c = 1$ throughout the course, so $x^0 = t$ is measured in metres (or seconds) like $x^i$; wherever a result is compared with a measurement we restore $c$ explicitly, and the lesson does so at the end. Readers of Tong's *Dynamics and Relativity* or of Taylor and Wheeler must flip the overall sign of every inner product below.

## Lorentz transformations as the isometries of the interval

Fix an inertial frame with coordinates $x^\mu = (t, x, y, z)$. The displacement between two events, $\Delta x^\mu$, has the invariant
$$\Delta s^2 = \eta_{\mu\nu}\Delta x^\mu\Delta x^\nu = -\Delta t^2 + \Delta x^2 + \Delta y^2 + \Delta z^2 .$$
A Lorentz transformation is a linear map $x'^\mu = \Lambda^\mu{}_\nu x^\nu$ between inertial coordinates; invariance of the interval for all displacements is the matrix condition
$$\Lambda^\alpha{}_\mu\,\Lambda^\beta{}_\nu\,\eta_{\alpha\beta} = \eta_{\mu\nu},\qquad\text{i.e.}\qquad \Lambda^T\eta\Lambda = \eta .$$
A boost along $x$ with speed $v$ has $\Lambda^0{}_0 = \Lambda^1{}_1 = \gamma$, $\Lambda^0{}_1 = \Lambda^1{}_0 = -\gamma v$, $\Lambda^2{}_2 = \Lambda^3{}_3 = 1$, with $\gamma = (1 - v^2)^{-1/2}$; rotations are the block-diagonal $\Lambda$ with a $3\times3$ orthogonal matrix. Adding translations gives the Poincaré group. The Lecture Guide's summary of Lecture 1 is exactly this: review of Lorentz transformations and invariant intervals, leading to the displacement 4-vector.

## Vectors, bases and the metric

**Definition (4-vector).** A 4-vector $\mathbf A$ is an object with components $A^\mu$ in each inertial frame that transform like the components of a displacement: $A'^\mu = \Lambda^\mu{}_\nu A^\nu$ (Lecture 1). The transformation law is the definition; having four components is not enough (see the warnings below).

Introduce basis vectors $\mathbf e_\alpha$ in each frame so that $\mathbf A = A^\alpha\mathbf e_\alpha$ is the same geometric object in every frame. Then the basis must transform with the inverse matrix, $\mathbf e'_\beta = (\Lambda^{-1})^\alpha{}_\beta\,\mathbf e_\alpha$, since $A'^\beta\mathbf e'_\beta = \Lambda^\beta{}_\nu A^\nu(\Lambda^{-1})^\alpha{}_\beta\mathbf e_\alpha = \delta^\alpha{}_\nu A^\nu\mathbf e_\alpha = \mathbf A$. A basis is a *coordinate basis* when the displacement is $\Delta\mathbf x = \Delta x^\alpha\mathbf e_\alpha$, i.e. $\mathbf e_\alpha = \partial\mathbf x/\partial x^\alpha$ (Lecture 2). In rectilinear inertial coordinates the $\mathbf e_\alpha$ are constant; in unit 2 they will not be.

**Definition (inner product and metric tensor).** $\mathbf A\cdot\mathbf B = \eta_{\alpha\beta}A^\alpha B^\beta$, with $\eta_{\alpha\beta} = \mathbf e_\alpha\cdot\mathbf e_\beta$. By the defining property of $\Lambda$ the number $\mathbf A\cdot\mathbf B$ is the same in every inertial frame; it is the metric's job to turn pairs of vectors into frame-independent numbers.

A vector is *timelike*, *null* or *spacelike* according as $\mathbf A\cdot\mathbf A$ is negative, zero or positive; in the $(+,-,-,-)$ convention these signs are reversed, which is why the convention must be declared.

## One-forms and tensors as multilinear maps

**Definition (one-form).** A linear map $\tilde p$ from vectors to real numbers. Its components are $p_\alpha = \tilde p(\mathbf e_\alpha)$, so $\tilde p(\mathbf A) = p_\alpha A^\alpha$. For this number to be frame independent the components must transform with the inverse matrix, $p'_\alpha = (\Lambda^{-1})^\beta{}_\alpha\,p_\beta$: lower indices transform oppositely to upper ones, and that is what makes a contracted pair invariant.

**Example (the gradient).** For a scalar field $\phi$, $\partial_\alpha\phi = \partial\phi/\partial x^\alpha$ transforms by the chain rule as $\partial'_\alpha\phi = (\partial x^\beta/\partial x'^\alpha)\partial_\beta\phi = (\Lambda^{-1})^\beta{}_\alpha\partial_\beta\phi$: the gradient is naturally a one-form. Along a worldline $x^\mu(\tau)$, $d\phi/d\tau = u^\alpha\partial_\alpha\phi$.

The metric supplies the canonical identification of vectors with one-forms: $A_\alpha \equiv \eta_{\alpha\beta}A^\beta$ ("lowering"), with inverse $A^\alpha = \eta^{\alpha\beta}A_\beta$ where $\eta^{\alpha\beta}\eta_{\beta\gamma} = \delta^\alpha{}_\gamma$ ("raising"). In an orthonormal inertial basis $\eta^{\alpha\beta}$ has the same numerical entries as $\eta_{\alpha\beta}$, which is a coincidence of that basis, not a general fact. The dual nature of vectors and one-forms is the content of Lecture 3.

**Definition ($(M,N)$ tensor).** A multilinear map taking $M$ one-forms and $N$ vectors to the reals (Lecture 2). Its components $T^{\alpha_1\dots\alpha_M}{}_{\beta_1\dots\beta_N}$ carry one factor of $\Lambda$ for each upper index and one factor of $\Lambda^{-1}$ for each lower index under a change of frame. The metric is a $(0,2)$ tensor, a vector a $(1,0)$ tensor, a one-form a $(0,1)$ tensor.

**Result (contraction).** Setting an upper index equal to a lower one and summing produces an $(M-1,N-1)$ tensor. **Derivation.** The pair contributes $\Lambda^\mu{}_\alpha(\Lambda^{-1})^\alpha{}_\nu = \delta^\mu{}_\nu$ to the transformation law, which removes both factors. $\square$ Summing two upper indices does *not* produce a tensor (exercise 2).

**Theorem (invariant tensors).** $\eta_{\mu\nu}$ and $\delta^\mu{}_\nu$ have the same components in every inertial frame. **Proof.** For $\eta$ this is the defining equation $\Lambda^T\eta\Lambda = \eta$ read as a $(0,2)$ transformation law; for $\delta$ it is $\Lambda\Lambda^{-1} = 1$. $\square$

## The 4-vectors of particle kinematics

**Derivation (4-velocity).** For a massive particle with worldline $x^\mu(\tau)$ parametrised by proper time, $d\tau^2 = -\eta_{\mu\nu}dx^\mu dx^\nu = dt^2(1 - v^2)$, so $dt/d\tau = \gamma$ and
$$u^\mu \equiv \frac{dx^\mu}{d\tau} = \gamma\,(1,\mathbf v),\qquad \mathbf u\cdot\mathbf u = -\gamma^2 + \gamma^2v^2 = -1 .$$
It is a 4-vector because $dx^\mu$ is and $d\tau$ is a scalar. In the particle's rest frame $u^\mu = (1,\mathbf 0)$.

**Derivation (4-momentum).** $p^\mu = m u^\mu = (\gamma m, \gamma m\mathbf v) = (E,\mathbf p)$, with $\mathbf p\cdot\mathbf p = -m^2$, i.e. $E^2 = |\mathbf p|^2 + m^2$. Restoring $c$: $p^0 = E/c$, $\mathbf p\cdot\mathbf p = -m^2c^2$, $E^2 = p^2c^2 + m^2c^4$, and for $v\ll c$, $E = mc^2 + \tfrac12mv^2 + O(v^4/c^2)$.

**Derivation (4-acceleration).** $a^\mu = du^\mu/d\tau$. Differentiating $\mathbf u\cdot\mathbf u = -1$ along the worldline gives $2\,\mathbf u\cdot\mathbf a = 0$: the 4-acceleration is Minkowski-orthogonal to the 4-velocity. In the momentary rest frame $u^\mu = (1,\mathbf 0)$, so $a^\mu = (0,\boldsymbol\alpha)$ and $\mathbf a\cdot\mathbf a = |\boldsymbol\alpha|^2\ge 0$: a spacelike vector whose invariant length is the acceleration felt in the rest frame, the *proper acceleration*. Exercise 1 integrates the case of constant $|\boldsymbol\alpha|$ (Lecture 2 lists these properties).

**Example (number flux and a conservation law).** Let a cloud of identical particles have number density $n$ in its local rest frame and 4-velocity $u^\mu$. The number-flux 4-vector is $N^\mu = n u^\mu$; its components in a frame where the cloud moves at $\mathbf v$ are $N^0 = \gamma n$ (the density is raised by the Lorentz contraction of the volume) and $N^i = \gamma n v^i$ (the flux). Conservation of particles is the scalar equation
$$\partial_\mu N^\mu = 0 \iff \partial_t(\gamma n) + \nabla\cdot(\gamma n\mathbf v) = 0,$$
the continuity equation; integrating over a spacetime region and using Gauss's theorem gives the integral form (Lecture 2 introduces both). Units with $c$: $N^0$ is a number per $\mathrm{m^3}$ and $N^i$ a number per $\mathrm{m^2\,s}$, so $N^\mu = n u^\mu$ with $u^0 = \gamma c$ requires the time component to be $cN^0$ — the usual bookkeeping of $x^0 = ct$.

## Derivatives, for now

In rectilinear inertial coordinates the matrices $\Lambda$ are constant, so $\partial_\mu$ commutes with the transformation law and $\partial_\mu T^{\alpha\beta}$ is a tensor (the Guide: "simple at this point, since we are working in special relativity and only considering rectilinear coordinates"). Unit 2 shows that this fails the moment the basis vectors vary from point to point — already in polar coordinates on a flat plane — and repairs it with the covariant derivative. That repair, not curvature, is the next step.

## Warnings

**Warning.** Four numbers do not make a 4-vector. $(E,\mathbf p)$ is one because $p^\mu = m\,dx^\mu/d\tau$; the quantities $(t, |\mathbf x|)$ or $(E, |\mathbf p|)$ are not. The test is always the transformation law.

**Warning.** Index placement is part of the content: $A^\alpha$ and $A_\alpha = \eta_{\alpha\beta}A^\beta$ differ in the sign of the time component in our convention. The symbol $\mathbf A\cdot\mathbf B$ never means $\sum_\alpha A^\alpha B^\alpha$.

**Warning.** Tensor equations are frame independent, so a tensor that vanishes in one inertial frame vanishes in all. The converse habit — proving a tensor identity in a convenient frame and concluding it everywhere — is legitimate and will be used constantly, but only for genuine tensors.

## What to carry forward

Tensors are multilinear maps; their components transform with one $\Lambda$ per upper index and one $\Lambda^{-1}$ per lower index; the metric converts vectors to one-forms and makes $\mathbf A\cdot\mathbf B$ frame independent; $u^\mu = \gamma(1,\mathbf v)$, $p^\mu = mu^\mu$, $\mathbf u\cdot\mathbf a = 0$; conservation laws are divergences of 4-vectors. Unit 2 adds the stress-energy tensor and the covariant derivative — still in flat spacetime.
