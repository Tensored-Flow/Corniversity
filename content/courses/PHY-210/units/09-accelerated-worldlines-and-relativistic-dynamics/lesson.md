# Acceleration is a worldline, not an exception to relativity

An accelerometer strapped to a rocket can read a steady value even while the rocket's coordinate acceleration approaches zero. There is no contradiction: the two instruments answer different questions. An accelerometer measures the acceleration relative to a momentarily comoving inertial observer. A laboratory records how velocity changes per unit of its own coordinate time. This unit connects those measurements and uses the connection to compare clocks on a finite-acceleration journey.

We use $X=(ct,x,y,z)$, $\eta=\operatorname{diag}(-1,1,1,1)$, and future-directed timelike worldlines. All calculations below take place in flat spacetime. Taylor and Wheeler use the opposite sign for a timelike interval; Tong also uses $(+,-,-,-)$. Changing that convention changes inner-product signs, not measured elapsed times.

## A clock on a curved worldline

For a massive particle with laboratory velocity $\mathbf v(t)$,

$$d\tau=\sqrt{1-|\mathbf v|^2/c^2}\,dt,\qquad U=\frac{dX}{d\tau}=\gamma(c,\mathbf v),\qquad U\cdot U=-c^2.$$

The elapsed time on an ideal clock is the integral of $d\tau$ along its own path. The endpoint interval gives that clock time only if the worldline is inertial between the endpoints. Acceleration changes the path; it does not add an extra universal term to the clock formula. Real clocks can be damaged or disturbed by acceleration, which is a separate instrumental limitation.

Differentiate $U\cdot U=-c^2$. With $A=dU/d\tau$, we obtain $U\cdot A=0$. In the instantaneous rest frame $U=(c,\mathbf0)$, so $A=(0,\boldsymbol\alpha)$. Thus $A\cdot A=|\boldsymbol\alpha|^2\geq0$. The magnitude $\alpha$ is proper acceleration. There is an instantaneous rest frame at each point of an accelerated worldline, but generally no single inertial frame in which the particle stays at rest throughout the journey.

## One dimension: use rapidity

Write $v/c=\tanh\theta$. Then

$$U=(c\cosh\theta,c\sinh\theta),\qquad A=c\dot\theta(\sinh\theta,\cosh\theta),$$

where the dot here means $d/d\tau$. Consequently $A\cdot A=c^2\dot\theta^2$, and signed proper acceleration is $a_*=c\dot\theta$. Since $dt/d\tau=\cosh\theta=\gamma$,

$$\frac{dv}{dt}=\frac{c\dot\theta}{\cosh^3\theta}=\frac{a_*}{\gamma^3}.$$

This relation is for collinear acceleration. Do not apply its $\gamma^3$ factor to an arbitrary transverse acceleration.

For constant positive $a_*=a$, initially at rest at $t=x=\tau=0$, integration gives

$$\theta=\frac{a\tau}{c},\quad t=\frac ca\sinh\frac{a\tau}{c},\quad x=\frac{c^2}a\left(\cosh\frac{a\tau}{c}-1\right).$$

The dimensions are useful checks: $c/a$ is a time and $c^2/a$ is a distance. Eliminating $\tau$ gives $(x+c^2/a)^2-c^2t^2=(c^2/a)^2$. This is a hyperbola in a flat spacetime diagram, not evidence that spacetime itself is curved. For $a\tau/c\ll1$, the series give $t\simeq\tau$ and $x\simeq a\tau^2/2$. At arbitrarily large finite $\tau$, $v=c\tanh(a\tau/c)$ still remains below $c$.

**Worked measurement.** Suppose a probe reaches $\theta=\log3$ under this acceleration. Then $\cosh\theta=5/3$, $\sinh\theta=4/3$, and $v=4c/5$. Its clock reads $(c/a)\log3$, the launch laboratory reads $4c/(3a)$, and the distance is $2c^2/(3a)$. Its coordinate acceleration has fallen to $27a/125$, even though its accelerometer still reads $a$. Each number follows from one hyperbolic identity; none requires inventing a velocity-dependent rest mass.

## Momentum, force and power

For a particle of constant invariant mass $m$, define $P=mU=(E/c,\mathbf p)$, $\mathbf f=d\mathbf p/dt$, and $K=dP/d\tau$. Differentiate $E^2-c^2|\mathbf p|^2=m^2c^4$ to obtain

$$\frac{dE}{dt}=\frac{c^2\mathbf p}{E}\cdot\mathbf f=\mathbf v\cdot\mathbf f,\qquad K=\gamma\left(\frac{\mathbf f\cdot\mathbf v}{c},\mathbf f\right)=mA.$$

Thus $K\cdot U=0$. The time component encodes power; it is not an additional independent force law. Integrating gives $\Delta E=\int\mathbf f\cdot d\mathbf x$ and kinetic energy $T=(\gamma-1)mc^2$. At low speed this becomes $mv^2/2$ to leading order.

As a worked check, in one dimension a constant laboratory force $f>0$ applied to a particle initially at rest gives $p=ft$. With $a=f/m$,

$$v=\frac{at}{\sqrt{1+(at/c)^2}},\qquad x=\frac{c^2}a\left[\sqrt{1+(at/c)^2}-1\right].$$

Then $fx=mc^2[\sqrt{1+(at/c)^2}-1]=T$. The laboratory acceleration decreases, while proper acceleration is constant. That equivalence uses one-dimensional motion, constant mass and constant laboratory force; it is not a general statement about rocket engines.

A rocket that burns fuel is an open subsystem. If its invariant mass changes, $d(mU)/d\tau=mA+\dot mU$ and $K\cdot U=-c^2\dot m$. One must account for exhaust four-momentum. Quoting $K=mA$ for the shrinking rocket discards a term and can violate conservation. The problem sheet asks you to diagnose this distinction rather than memorise a rocket equation without its exhaust assumptions.

## A round trip without an instantaneous velocity jump

Take four equal proper-time legs of duration $\tau_0$, with signed proper accelerations $+a,-a,-a,+a$. Set $r=a\tau_0/c$. Rapidity runs $0\to r\to0\to-r\to0$. Integrate $dt/d\tau=\cosh\theta$ and $dx/d\tau=c\sinh\theta$ on each leg. The spatial displacements cancel; the traveller returns at rest. The travelling clock reads $4\tau_0$, while the Earth clock reads $4(c/a)\sinh r$.

Since $\sinh r>r$ for $r>0$, the traveller ages less. Both clocks are compared at the same departure and reunion events. The trajectory has continuous velocity and finite piecewise-constant acceleration; acceleration changes abruptly at switches. Smoothing those switches changes the integrals continuously and leaves the explanation intact. A fully smooth rapidity profile is an exercise. Acceleration identifies the different paths, but a claim that acceleration itself 'slows the clock' misses the integral that predicts the result.

## Sources and independent work

Read Taylor and Wheeler, *Spacetime Physics*, §§5.6–5.8, printed pp.148–160, for accumulated clock time and the ideal-clock assumption ([chapter 5](https://www.eftaylor.com/spacetimephysics/05_chapter5.pdf), CC BY4.0). Tong's [§§7.4.5–7.4.6](https://davidtong.org/pdfs/teaching/dynamics-and-relativity/dynrel7.pdf) gives a second account of force and acceleration, with the opposite metric signature; it is reference-only. These notes and the problems use original derivations and examples.

Before the tutorial, reproduce the hyperbolic worldline from $a_*=c\,d\theta/d\tau$, then derive the power identity from the mass shell. In the problems, identify which clock, which frame, and whether the chosen system has constant mass before using an equation.
