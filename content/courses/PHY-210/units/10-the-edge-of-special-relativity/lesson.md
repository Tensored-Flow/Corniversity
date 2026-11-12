# How large is an inertial laboratory?

Two floating masses in a freely falling laboratory can slowly approach one another. An accelerometer attached to either ideal test mass reads zero. The separation nevertheless changes. The first observation concerns local motion along one worldline; the second compares neighbouring motions across a region. Understanding both is the final task of this course.

We use SI units and signature $(-,+,+,+)$. Sections labelled **preview** motivate general relativity; they are not deductions from flat Minkowski geometry alone.

## From uniform acceleration to tides

In Newtonian notation let the gravitational acceleration be $\mathbf g(\mathbf r)$. A frame whose origin falls along a chosen trajectory removes the acceleration of that origin. For nearby freely falling masses separated by $\boldsymbol\xi$, the remaining relative acceleration, to first order, is

$$\ddot\xi^i=\frac{\partial g^i}{\partial x^j}\xi^j.$$

A spatially uniform field has zero derivative. A field gradient leaves a tidal term. This model neglects mutual attraction of the test masses, air resistance, apparatus rotation and other forces. An electric-field gradient can also produce relative acceleration, so relative motion without those controls is not sufficient evidence for gravity.

Outside a spherical body of mass $M$,

$$g^i=-\frac{GMx^i}{r^3},\qquad\frac{\partial g^i}{\partial x^j}=\frac{GM}{r^3}(3n^in^j-\delta^i_j),\quad\mathbf n=\mathbf r/r.$$

Differentiate the components yourself, then apply the matrix to radial and transverse vectors. Radial separations stretch with coefficient $2GM/r^3$; each transverse direction compresses with coefficient $-GM/r^3$. These coefficients have units $\mathrm{s^{-2}}$. The trace vanishes outside the body, but the matrix does not: trace-free does not mean tide-free.

**Worked scale estimate.** Consider a radial pair initially $L=5.0\,\mathrm m$ apart with no relative velocity. Take $g=9.8\,\mathrm{m\,s^{-2}}$ and $R=6.4\times10^6\,\mathrm m$. Approximating $GM/r^3$ by $g/R$ gives $\ddot L\simeq2gL/R=1.53\times10^{-5}\,\mathrm{m\,s^{-2}}$. After $2.0\,\mathrm s$, $\Delta L\simeq\tfrac12\ddot L t^2=3.06\times10^{-5}\,\mathrm m$. Both the field and separation must change little over the experiment for this estimate to apply. A detector insensitive to tens of micrometres could treat the region as inertial at that accuracy; a finer detector needs a smaller region, a shorter duration, or a tidal correction.

## A geometric analogy, used carefully

On a sphere of radius $R$, two nearby meridians have transverse separation approximately $d(s)=d_0\cos(s/R)$ after their travellers walk distance $s$ north from the equator. Each follows a geodesic, yet $d''(s)=-d(s)/R^2$. Convergence does not require sideways steering.

The sphere is an analogy, not spacetime itself. Its metric is positive-definite and its parameter here is distance; spacetime is Lorentzian and we compare free-fall separation against an observer's time. Intrinsic curvature does not require an imagined surrounding space. A rubber-sheet picture therefore cannot supply a gravitational explanation by secretly invoking an external downward force.

**Preview: curvature.** Freely falling coordinates can make the metric Minkowskian and its first derivatives vanish at an event. Curvature is an obstruction to extending that simplification over a region, and it produces tidal relative motion of neighbouring geodesics. A nonzero coordinate acceleration is not proof of curvature: unit9 already describes accelerated paths in flat spacetime. Conversely, zero proper acceleration along one worldline does not prove its neighbourhood is flat.

## Clock-rate differences in flat spacetime

Here is an exact counterexample to the claim that varying clock rates automatically imply curvature. Set $\rho=c^2/a$ and introduce coordinates in a wedge of flat spacetime:

$$ct=(\rho+\xi)\sinh(a\eta/c),\qquad x+\rho=(\rho+\xi)\cosh(a\eta/c),\qquad\xi>-\rho.$$

The coordinate $\eta$ has units of time and $\xi$ labels an accelerated observer. Differentiate both expressions and subtract their squares. Cross terms cancel, leaving

$$ds^2=-c^2(1+a\xi/c^2)^2d\eta^2+d\xi^2.$$

A clock at fixed $\xi$ reads $d\tau=(1+a\xi/c^2)d\eta$. The different clock rates refer to equal increments of the common coordinate time. They coexist with a flat metric because we obtained the entire description by a coordinate transformation. The observers' proper accelerations are $a/(1+a\xi/c^2)$, so the different parts of this rigid accelerating laboratory do not have equal proper accelerations.

Suppose repeated light pulses travel from $\xi=0$ to $\xi=h>0$. Stationarity makes the coordinate travel time the same for each pulse, so emission and reception intervals have equal $\Delta\eta$. Count cycles per local proper time to obtain

$$\frac{\nu_h}{\nu_0}=\frac{1}{1+ah/c^2}\simeq1-\frac{ah}{c^2}\quad(|ah|\ll c^2).$$

The higher receiver sees a lower frequency. This accelerated-laboratory redshift is derived within special relativity.

**Preview: a weak gravitational field.** The equivalence principle relates a sufficiently small accelerated laboratory to a supported laboratory in a gravitational field, to the accuracy at which tides can be neglected. In a weak static field the corresponding first-order prediction for light climbing a potential difference $\Delta\Phi>0$ is $\Delta\nu/\nu\simeq-\Delta\Phi/c^2$; higher supported clocks run faster. This statement adds gravitational physics and approximation hypotheses. The flat coordinate transformation has not derived a global gravitational metric or Einstein's field equations.

## A light beam in a rising lift

In a local inertial frame a horizontal light pulse travels at $c$. A small lift, initially at rest, accelerates upward by approximately constant $g$ during the crossing. In time $t\simeq x/c$ its floor rises by $gt^2/2$. Relative to the lift the ray therefore drops by $y\simeq-gx^2/(2c^2)$, for $gx/c^2\ll1$. In the inertial frame the ray remains straight.

The equivalence principle makes this a local illustration of gravitational deflection. It does not determine the entire angle accumulated on a trajectory past a star. That calculation requires the gravitational geometry along the ray, beyond the small-laboratory approximation. Distinguishing motivation from a complete derivation is part of learning the theory.

## A connected account of the course

Minkowski geometry supplies the interval, causal cones and proper time. Linear isometries satisfy $\Lambda^T\eta\Lambda=\eta$; adjoining translations gives the Poincaré transformations. A collinear boost has a rapidity parameter. Consistently oriented forward-time inertial frames use the proper, orthochronous component. General Lorentz transformations also include spatial rotations, and non-collinear boosts need not commute.

For particles, $P=(E/c,\mathbf p)$ obeys $P^2=-m^2c^2$. Conservation of the total four-momentum connects that geometry to collisions and decays. System mass includes internal kinetic energy and need not equal the sum of constituent rest masses. Accelerated worldlines also fit the framework when the force law and system boundary are stated. The framework does not supply an equation determining curved spacetime from matter, or a global conservation formula for every curved spacetime.

The final synthesis asks you to establish these connections with calculations. Finish by naming a reliable prediction, its assumptions, and a measurement that would require modelling something outside them.

## Reading and attribution

Taylor and Wheeler, *Spacetime Physics*, [§2.3, pp.30–34](https://www.eftaylor.com/spacetimephysics/02_chapter2.pdf) and [§§9.4–9.6, pp.280–287](https://www.eftaylor.com/spacetimephysics/09_chapter9.pdf), CC BY4.0, motivate the local laboratory and two-traveller analogy. These notes supply original derivations and examples. MIT8.20 [week4, lectures12.1–12.3](https://ocw.mit.edu/courses/8-20-introduction-to-special-relativity-january-iap-2021/pages/video-lectures/week-4-beyond-special-relativity/) gives a second explanation of the equivalence principle, clock shifts and light bending. Historical observational comments in the1992 book are not used as evidence of present-day observational status.
