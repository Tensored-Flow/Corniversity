# The light cone tells you which events can influence which

Choose an event O as origin. The future light cone consists of events with $ct=|\mathbf x|$ and $t\geq0$. Its interior has $ct>|\mathbf x|$; its exterior has $|ct|<|\mathbf x|$. With our signature $(-,+,+,+)$, these give null, timelike and spacelike displacement vectors respectively. The null cone includes a degenerate case at O itself; when discussing a light signal between two events, we mean distinct events.

A causal relation is a possibility allowed by the geometry, not a claim that an influence actually occurred. A timelike event in your future might be influenced by a sufficiently fast subluminal signal; it need not have been caused by you. Spacelike events can share a common cause even though neither can send a causal signal to the other. This distinction matters whenever correlations are described as communication.

## Why time order survives a physical change of frame

Suppose $\Delta t>0$ and $c\Delta t\geq|\Delta\mathbf x|$. Under a boost of velocity $\mathbf v$,

$$\Delta t'=\gamma\left(\Delta t-\frac{\mathbf v\cdot\Delta\mathbf x}{c^2}\right).$$

By Cauchy–Schwarz,

$$\Delta t'\geq\gamma\Delta t(1-|\mathbf v|/c)>0$$

for distinct future-directed causal events and $|\mathbf v|<c$. Spatial rotations do not change time. Thus time-orientation-preserving Lorentz transformations preserve the order of causally related events. The full Lorentz group also contains mathematical time reversal; we do not treat it as an ordinary change between future-oriented observers. Invariance of the interval alone would not exclude that reversal.

For a spacelike displacement along $x$, a boost with $v=c^2\Delta t/\Delta x$ makes the events simultaneous. The speed is admissible because $|c\Delta t|<|\Delta x|$. Nearby boost speeds on either side give opposite time orders. For timelike separation, the admissible boost $v=\Delta x/\Delta t$ makes the positions coincide instead. A distinct null pair admits neither a common-location frame nor a simultaneous frame; either would require a boost at $c$.

**Worked classification.** Let $\Delta(ct,x)=(2,6)\,\mathrm m$. Its square is $32\,\mathrm m^2>0$, so it is spacelike. A boost at $c/3$ makes $\Delta t'=0$. A boost at $2c/3$, with $\gamma=3/\sqrt5$, gives $\Delta ct'=-6/\sqrt5\,\mathrm m$ and $\Delta x'=14/\sqrt5\,\mathrm m$. Their squared interval remains 32. Nothing physical has travelled from one event to the other; we have only relabelled them.

## A causal path cannot escape by taking many short steps

Let consecutive future-directed causal displacements have time lapses $\Delta t_i\geq0$ and spatial vectors $\Delta\mathbf x_i$ satisfying $|\Delta\mathbf x_i|\leq c\Delta t_i$. Then

$$\left|\sum_i\Delta\mathbf x_i\right|\leq\sum_i|\Delta\mathbf x_i|\leq c\sum_i\Delta t_i.$$

Their total displacement is causal too. The same conclusion follows for a continuous causal path by integration. A relay station cannot send an ordinary message outside the original sender's future light cone by changing directions or switching frames. For the total displacement to be null, all nonzero segments must be null and point along the same spatial direction; otherwise at least one inequality is strict. Even a path made entirely of light segments can have timelike-separated endpoints if it turns a corner.

This also explains a common trap. Two flashes emitted in opposite directions from O reach two distant detectors at events A and B. O can cause both detections, while A and B are spacelike separated. Their common origin does not supply a channel from A to B.

## What a hypothetical faster-than-light messenger would imply

Suppose in one frame a controllable message travels with speed $u>c$ along $+x$. Its travel time in a boost frame is proportional to $1-vu/c^2$, and becomes negative when $v>c^2/u$. This reverses the coordinate order of that spacelike pair. By itself, that observation does not construct a contradiction: an arbitrary geometric spacelike pair is harmless, and reversing its labels does not create a communication device.

A causal loop needs additional physical assumptions. Suppose every inertial sender can send an immediate, controllable reply at the same superluminal speed magnitude $u$ in its own rest frame, in either direction, with no preferred frame restricting the device. Alice and Bob meet at $t=0$. Bob then moves away at speed $v$. At Alice time $t_0>0$, Alice sends the hypothetical message at speed $u$. It reaches Bob at

$$t_B=\frac{ut_0}{u-v},\qquad x_B=vt_B.$$

Bob replies toward Alice at speed $-u$ in his frame. Transform the displacement from B to reception C and impose $\Delta x'=-u\Delta t'$. Solving at $x_C=0$ gives

$$t_C=\frac{u^2(1-v^2/c^2)}{(u-v)^2}t_0.$$

Consequently $t_C<t_0$ when $v/c>2(u/c)/(1+(u/c)^2)$. The exercise asks you to derive this result and check that Bob sends the reply forward in his own time. This is a conditional argument about an assumed signalling rule, not a claim that such a device exists. Superluminal phase velocities, moving light spots and quantum correlations do not automatically satisfy these controllable two-way signalling assumptions.

## Reading an older source critically

Taylor and Wheeler, [*Spacetime Physics*, chapter 6](https://www.eftaylor.com/spacetimephysics/06_chapter6.pdf), §§6.1–6.3, motivates the causal classification and light cones (CC BY 4.0). Their positive 'timelike interval squared' is $-\Delta s^2$ in our notation. The 1992 text lists neutrinos as light-speed particles on p.176; that example is outdated. Neutrino oscillation evidence establishes nonzero neutrino mass differences, so neutrinos cannot all be treated as massless particles ([Royal Swedish Academy/Nobel Physics 2015](https://www.nobelprize.org/prizes/physics/2015/press-release/)). We use vacuum photons as the physical null example and make no claim that gravitons have been detected.

For the mid-course synthesis, give an event table and two labelled spacetime diagrams. Separate an invariant calculation, a frame-dependent time ordering and a physical signalling assumption. The aim is to locate the exact premise behind a paradox rather than answer it with the slogan 'everything is relative'.
