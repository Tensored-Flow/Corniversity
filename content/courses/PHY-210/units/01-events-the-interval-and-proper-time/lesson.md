## Conventions first

Everything in this course is special relativity: flat Minkowski spacetime, no gravity. Units are SI, with the speed of light $c = 299\,792\,458\ \mathrm{m\,s^{-1}}$ exactly (since the 1983 redefinition of the metre, which Taylor and Wheeler quote in Section 1.4). Following them we will often measure time in metres: $ct$ is the distance light travels in time $t$, and $1\ \mathrm{m}$ of light-travel time is $1/299\,792\,458\ \mathrm{s} \approx 3.3356\ \mathrm{ns}$.

Corniversity's sign convention is the metric signature $(-,+,+,+)$. For two events separated by $\Delta t$ in time and $(\Delta x,\Delta y,\Delta z)$ in space in some inertial frame,
$$\Delta s^2 = -c^2\Delta t^2 + \Delta x^2 + \Delta y^2 + \Delta z^2 .$$
Taylor and Wheeler use the opposite overall sign and a different bookkeeping: they write $(\text{interval})^2 = (c\Delta t)^2 - (\Delta x)^2$ when time separation dominates (Eqs. 1-4 to 1-6) and reverse the order when space separation dominates (Section 1.4), so that their "interval" is always a non-negative real number. Tong's *Dynamics and Relativity* uses $\Delta s^2 = c^2\Delta t^2 - |\Delta\mathbf x|^2$ throughout (Section 7.3.1). The dictionary is simply $\Delta s^2_{\rm ours} = -\Delta s^2_{\rm Tong}$, and the book's timelike interval is $\sqrt{-\Delta s^2_{\rm ours}}$. Nothing physical depends on the choice; everything notational does, so state the convention at the top of every calculation.

## The parable, and the thing it is a parable for

Taylor and Wheeler open with two surveyors who measure the same town using different norths (Section 1.1). Their northward and eastward coordinates of every stake disagree, yet the combination $(\text{north})^2 + (\text{east})^2$, once both are expressed in metres, agrees to every decimal: it is the squared distance, invariant under rotation of the axes. The lesson for physics is exact: observers in relative motion disagree about the time separation and the space separation of two events, yet one combination of the two agrees.

**Definition (event).** A point of spacetime: a place and a time. A spark jumping, a particle detection, a clock reading a particular value. Events are the stakes of physics (Section 1.3).

**Definition (inertial, or free-float, frame).** A reference frame — in principle a lattice of rods and synchronised clocks — in which a free particle moves with constant velocity. Unit 3 gives the operational construction (Chapter 2 of the book); for now we take such frames as given, and "laboratory frame" and "rocket frame" are two of them in uniform relative motion.

## The invariant interval

**Definition (spacetime interval).** For events $A$ and $B$ with coordinate separations $\Delta t,\Delta x,\Delta y,\Delta z$ in an inertial frame, $\Delta s^2 = -c^2\Delta t^2 + \Delta x^2+\Delta y^2+\Delta z^2$. It has units of $\mathrm{m^2}$; it may be negative, zero or positive.

**Result (invariance of the interval).** $\Delta s^2$ has the same value in every inertial frame.

This is the central fact of the subject. Chapter 1 of the book asserts it and exhibits its consequences; Chapter 3 derives it from the principle of relativity (unit 2 of this course reproduces that derivation). Here is the book's data (Table 1-3, Section 1.2). A rocket carrying Mary passes John in his laboratory corridor; sparks jump from the rocket's antenna to objects along the corridor. For the pen spark and the fire-extinguisher spark, John measures $\Delta x = 2.0000\ \mathrm m$ and $\Delta t = 33.6900\ \mathrm{ns}$; Mary, for whom both sparks occur at the tip of her antenna, measures $\Delta x' = 0$ and $\Delta t' = 33.0228\ \mathrm{ns}$. Convert the times to metres with $c = 0.299\,792\,458\ \mathrm{m\,ns^{-1}}$: $c\Delta t = 10.1000\ \mathrm m$, $c\Delta t' = 9.9000\ \mathrm m$. Then
$$\Delta s^2 = -(10.1000)^2 + (2.0000)^2 = -102.010 + 4.000 = -98.010\ \mathrm{m^2},\qquad \Delta s'^2 = -(9.9000)^2 + 0 = -98.010\ \mathrm{m^2}.$$
Different time separations, different space separations, the same interval (the book's Table 1-4 does the same arithmetic in its sign convention). Mary's speed relative to John is $v = \Delta x/\Delta t = 0.0594\ \mathrm{m\,ns^{-1}} = 0.198\,c$.

**Warning.** A negative $\Delta s^2$ is not a defect. Euclidean distance squared is a sum of squares and so is never negative; the Lorentz geometry of spacetime subtracts, and the sign of $\Delta s^2$ carries information (below). Taylor and Wheeler ask "Why the minus sign?" on page 7 and answer: because experiment says so, every day, in every accelerator.

## Proper time

**Definition (proper time).** When two events occur at the same place in some inertial frame — equivalently, when a single clock moving uniformly can be present at both — the time between them read by that clock is the proper time $\tau$. The book calls it wristwatch time (Section 1.3, printed pages 9–10). In that clock's frame $\Delta x' = 0$, so $\Delta s^2 = -c^2\tau^2$, i.e.
$$\tau = \frac{\sqrt{-\Delta s^2}}{c}\qquad(\Delta s^2 < 0).$$
Because $\Delta s^2$ is invariant, every observer can compute $\tau$ from their own coordinate separations, and all agree on its value. Mary's $33.0228\ \mathrm{ns}$ is the proper time between the two sparks; John computes the same number from his $2.0000\ \mathrm m$ and $33.6900\ \mathrm{ns}$ without ever consulting Mary.

**Derivation (proper time of a uniformly moving clock).** Let a clock move with speed $v$ in the laboratory frame and tick at events $A$ and $B$. In the laboratory, $\Delta x = v\Delta t$, so $\Delta s^2 = -c^2\Delta t^2 + v^2\Delta t^2$. In the clock's frame $\Delta s^2 = -c^2\tau^2$. Invariance gives
$$\tau = \Delta t\sqrt{1 - v^2/c^2} \le \Delta t .$$
Units: $v^2/c^2$ is dimensionless, $\tau$ and $\Delta t$ are both times. Limiting cases: $v\ll c$ gives $\tau\approx\Delta t\,(1 - v^2/2c^2)$, indistinguishable from $\Delta t$ in daily life (for $v = 300\ \mathrm{m\,s^{-1}}$ the correction is $5\times10^{-13}$); $v\to c$ gives $\tau\to 0$. The book's Sample Problem 1-1 is the case $c\Delta t = 5\ \mathrm m$, $\Delta x = 4\ \mathrm m$: the rocket moves at $\tfrac45c$, the interval is $\sqrt{25-16} = 3\ \mathrm m$, and the rocket clock reads $3\ \mathrm m$ of time between sparks while the laboratory clocks read $5\ \mathrm m$. Check: $5\sqrt{1 - 16/25} = 5\cdot\tfrac35 = 3$.

**Example (a starship to Proxima Centauri; Sample Problem 1-2c re-done).** Earth frame: distance $4.3\ \mathrm{ly}$, speed $0.95c$, so $\Delta t = 4.3/0.95 = 4.526\ \mathrm{yr}$. Proper time on board: $\tau = 4.526\sqrt{1-0.9025} = 4.526\times0.3122 = 1.41\ \mathrm{yr}$. The book rounds the Earth time to $4.53\ \mathrm{yr}$ and gets $1.42\ \mathrm{yr}$; the difference is rounding, and it is a good habit to carry one more figure than you report. The physics: the ship's clock, present at both departure and arrival, reads the proper time, which is less than the time between those events in any frame in which they occur at different places.

## Timelike, spacelike, lightlike

The sign of $\Delta s^2$ classifies pairs of events (Section 1.4; Tong Section 7.3.1):

- **Timelike** ($\Delta s^2 < 0$): $c|\Delta t| > |\Delta\mathbf x|$ in every frame. There is a frame in which the events occur at the same place; the proper time between them is $\sqrt{-\Delta s^2}/c$. A clock can be present at both.
- **Lightlike** or null ($\Delta s^2 = 0$): $c|\Delta t| = |\Delta\mathbf x|$. The events can be connected by a light flash. Zero interval does *not* mean the same event — a difference from Euclidean geometry that Tong flags.
- **Spacelike** ($\Delta s^2 > 0$): $|\Delta\mathbf x| > c|\Delta t|$. There is a frame in which the events are simultaneous, and in it their separation $\sqrt{\Delta s^2}$ is the proper distance, measurable with a rod laid between them (the book's "spacelike interval"). No clock, and no signal slower than light, can be present at both.

The classification is frame independent because $\Delta s^2$ is. Unit 5 develops the consequences for causality; for now, note that the book's two handclaps in New York and San Francisco, simultaneous in the Earth frame, are a spacelike pair, so the question "which happened first?" has no frame-independent answer — exactly what unit 2 will find.

**Derivation (the frame in which two timelike events coincide).** With $\Delta x > 0$ along the motion, a frame moving at $v = \Delta x/\Delta t$ relative to the laboratory sees both events at the same place. This requires $v < c$, i.e. $\Delta x < c\Delta t$: the timelike condition. For a spacelike pair the same formula gives $v > c$, which no frame achieves, and instead a frame with $v = c^2\Delta t/\Delta x < c$ makes the events simultaneous (unit 2 derives this from the Lorentz transformation).

## Same unit for space and time

The book's Section 1.4 makes a point that is worth taking literally: $c$ is a conversion factor between two historically different units for one geometry, like $k = 1609.344\ \mathrm{m\,mile^{-1}}$ in the parable. Measuring time in metres (laboratory physics), seconds or minutes (the solar system: the Sun is $499\ \mathrm{s}$ away) or years (the stars: Proxima Centauri at $4.28\ \mathrm{ly}$) is a choice of unit, not of physics. In this course we write $c$ explicitly in every formula, so that units can be checked, and set it to 1 only in diagrams and quick estimates — saying so each time.

**Warning.** "Moving clocks run slow" is shorthand that invites error. A clock does not know it is moving. What is true is frame independent: the proper time along a uniformly moving clock's path between two events is less than the coordinate time between those events in any frame in which they are at different places. Exercise 3 asks you to say this in your own words with numbers.

## What to carry forward

Events are the primitive objects; the interval $\Delta s^2 = -c^2\Delta t^2 + \Delta\mathbf x^2$ is the invariant that replaces Euclidean distance; its sign sorts pairs of events into timelike, lightlike and spacelike; proper time is $\sqrt{-\Delta s^2}/c$ and is read directly by a clock present at both events. Unit 2 derives the invariance from the principle of relativity and turns it into the Lorentz transformation.
