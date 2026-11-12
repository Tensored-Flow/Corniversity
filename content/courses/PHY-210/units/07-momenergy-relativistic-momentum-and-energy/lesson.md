# Energy and momentum are components of one vector

Energy is conserved, momentum is conserved, yet different observers assign different values to each. The compact statement is conservation of total four-momentum. A Lorentz transformation changes its components coherently, so a conservation equation true in one inertial frame remains true in every other.

Use $P=(E/c,\mathbf p)$ and $\eta=\operatorname{diag}(-1,1,1,1)$. Every component of P then has units of momentum. Taylor and Wheeler often express energy and momentum in mass units with $c=1$; restoring $c$ requires care. In SI,$E$ and $|\mathbf p|$ cannot be added directly.

## Massive particles and the mass shell

For an isolated point particle of constant invariant mass $m>0$, define $P=mU$. The normalisation is chosen to recover Newtonian momentum at low speed. From $U=\gamma(c,\mathbf v)$,

$$E=\gamma mc^2,\qquad\mathbf p=\gamma m\mathbf v,\qquad P\cdot P=-m^2c^2.$$

Hence

$$E^2=c^2|\mathbf p|^2+m^2c^4,\qquad \mathbf v=\frac{c^2\mathbf p}{E}.$$

The positive energy branch describes the particles in this course. Rest energy is $mc^2$ and kinetic energy is $T=E-mc^2$. The mass $m$ is an invariant property of this particle, while $\gamma m$ depends on the observer. We do not rename $\gamma m$ as its 'relativistic mass': that terminology obscures which quantity is invariant.

Expanding for $\beta=|\mathbf v|/c\ll1$,

$$\mathbf p=m\mathbf v\left(1+\frac{\beta^2}{2}+O(\beta^4)\right),\quad T=\frac12m|\mathbf v|^2+\frac38m\frac{|\mathbf v|^4}{c^2}+O(m|\mathbf v|^6/c^4).$$

These are approximations with a dimensionless small parameter. The large constant rest energy remains in total energy even when it cancels from a fixed-mass Newtonian problem. If particle composition or internal energy changes, dropping it can destroy energy bookkeeping.

**Worked inference.** Suppose a detector measures $E=5mc^2$ and $\mathbf p=(0,4mc,0)$, where $m$ is a reference mass unit rather than an already identified particle mass. The actual invariant mass is $\sqrt{25-16}\,m=3m$, and its velocity is $(0,4c/5,0)$. The measured energy is consistent with $\gamma=5/3$ times that actual rest energy. Inferring mass requires energy and momentum together; energy alone is insufficient.

## A boost mixes energy with momentum

For an $x$ boost at speed $v$,

$$E'=\gamma_v(E-vp_x),\qquad p'_x=\gamma_v(p_x-vE/c^2),\qquad p'_y=p_y,\quad p'_z=p_z.$$

The two $\gamma$ factors that may appear in a calculation have different roles: one describes the particle's velocity in a frame, the other the relative boost between frames. Label them or use the four-vector directly.

A future timelike or null momentum has $E\geq c|\mathbf p|$. Therefore $E'\geq\gamma_v E(1-|v|/c)>0$ for a nonzero positive-energy particle. No subluminal observer assigns it negative energy simply by overtaking the frame. The invariant mass computed from $E'$ and $\mathbf p'$ agrees with that from the unprimed components.

## Massless does not mean energyless

A vacuum photon has $P\cdot P=0$ and $E=c|\mathbf p|>0$. It cannot be written as $mU$ with a finite massive-particle four-velocity at $m=0$. Instead energy and propagation direction specify its null momentum. Its energy is frame dependent even though its mass is zero in every inertial frame.

For a photon making angle $\theta$ with $+x$ in S,$p_x=(E/c)\cos\theta$. The energy boost gives

$$\frac{E'}E=\gamma_v(1-\beta\cos\theta).$$

Dividing the transformed longitudinal momentum by $E'/c$ gives the aberration law $\cos\theta'=(\cos\theta-\beta)/(1-\beta\cos\theta)$. Both frequency and direction change. For a photon moving along $+x$, the energy factor reduces to $\sqrt{(1-\beta)/(1+\beta)}$, matching the receding Doppler factor derived from pulse timing in unit 4.

## Choose the system before conserving its momentum

For noninteracting asymptotic particles, add their four-momenta. For a closed interacting system one must also include relevant fields and internal energy; summing only visible outgoing particles may miss radiated energy or unobserved products. Conservation is a statement about the chosen complete system, not a guarantee that every subsystem's energy stays fixed.

When $P_{\rm tot}$ is timelike, define its invariant mass M by

$$M^2c^4=E_{\rm tot}^2-c^2|\mathbf p_{\rm tot}|^2.$$

The centre-of-momentum frame moves at $\mathbf V=c^2\mathbf p_{\rm tot}/E_{\rm tot}$. There $\mathbf p_{\rm tot}'=0$ and $E_{\rm tot}'=Mc^2$. A parallel collection of photons has null total momentum and no such rest frame. Nonparallel photons can have a timelike total, despite each having zero individual mass.

**Worked inelastic collision.** Two particles of mass $m$ approach head-on at speeds $3c/5$ in their centre-of-momentum frame. Each has $\gamma=5/4$. If they merge and no energy escapes, the stationary product has mass $M=2\gamma m=5m/2$, not $2m$. Initial kinetic energy became internal energy; the invariant mass of the whole system was $5m/2$ both before and after. If radiation escapes from the product, include it when conserving the closed system; the product alone can then have a lower mass.

This resolves the phrase 'mass is converted into energy'. The sum of constituent rest masses can change, but total four-momentum and the invariant mass of an isolated complete system are conserved. Mass and energy are related quantities with different units and transformation properties, not two liquids exchanged without bookkeeping.

## Reading and checks

Taylor and Wheeler, [chapter 7](https://www.eftaylor.com/spacetimephysics/07_chapter7.pdf), §§7.2–7.6, develops the four-momentum picture, and [chapter 8 §§8.1–8.4](https://www.eftaylor.com/spacetimephysics/08_chapter8.pdf) distinguishes system mass from individual masses (CC BY 4.0). The SI equations and worked values here are original. Treat dated particle examples cautiously; massless photons suffice for the null case.

For every tutorial answer, name the frame, list the system, compute an invariant, and check a limit. If your result makes a massive particle reach $c$ at finite energy, or makes total mass equal the sum of rest masses in a hot moving system by definition, inspect the starting assumptions before the arithmetic.
