# What an inertial observer actually measures

A photograph of two clocks is not a measurement of their readings at the same coordinate time. Light from the more distant clock left earlier. Relativity becomes much easier when an 'observer' means a specified measuring system, with records taken locally and compared later, rather than a person looking through a telescope.

We retain SI units and $\Delta s^2=-c^2\Delta t^2+|\Delta\mathbf x|^2$. Taylor and Wheeler's timelike interval has the opposite sign before taking a square root. This unit gives the operational meaning of the coordinates used in the first two units: which rods, which clocks, and which checks make a frame suitable for a Lorentz transformation.

## Free-float is a test, not a label

An inertial frame is one in which freely moving test bodies have constant coordinate velocities, within the stated accuracy and over the stated region. Test several bodies, initial positions and velocities. One ball remaining at rest is insufficient: a rotating laboratory can keep a ball on its rotation axis while other free particles reveal the rotation. 'Free' means relevant nongravitational forces have been removed or accounted for. A test particle is small enough that its own influence on the other apparatus is negligible at the accuracy of the experiment; it is not necessarily microscopically small.

In ideal Minkowski spacetime this construction extends globally. Near a gravitating body, a freely falling laboratory is only approximately inertial over a sufficiently small region and duration. Neighbouring test particles can develop relative acceleration due to tides. The size of the usable region depends on the tolerance: 'local' is not a universal number of metres. We return to the geometry behind this limitation in unit 10. An accelerating rocket is not inertial simply because its cabin appears motionless to its passenger.

An inertial coordinate system also requires nonrotating axes and a choice of origin. Translating an origin changes coordinates, but not coordinate differences between events. Uniformly moving inertial systems assign different space and time differences while agreeing on the Minkowski interval.

## Build a clock lattice

Imagine identical clocks at rest at known positions in an inertial frame. A local detector records an event's time on the nearest clock and its position on the rod lattice. Refining the lattice reduces position uncertainty and the short light-delay correction between event and detector. The data can be collected later; that transmission delay affects when we know the event, not when it occurred in the chosen frame.

To synchronise clocks, send light from the origin at its time $t=0$. A clock at distance $r$ is set to read $r/c$ when the flash arrives. Equivalently, send a pulse from clock A at time $t_1$, reflect it at a stationary clock B, and receive it back at A at $t_3$. Assign the reflection event time

$$t_B=\frac{t_1+t_3}{2},\qquad L=\frac c2(t_3-t_1).$$

This is Einstein synchronisation in an inertial frame, using equal outward and inward light travel times. It is the convention built into our Lorentz coordinates. It must not be confused with an independently synchronised pair of clocks measuring a one-way speed. A physical time-of-flight experiment must state how its separated clocks were set.

**Worked calibration.** At A, the emission and return readings are $4.0\,\mu\mathrm s$ and $14.0\,\mu\mathrm s$. The reflection is assigned $9.0\,\mu\mathrm s$, and B is $5.0\,\mu\mathrm s\times c\simeq1499\,\mathrm m$ away. If B's display says $8.2\,\mu\mathrm s$ at reflection, its offset from the assigned coordinate time is $-0.8\,\mu\mathrm s$. No conclusion about a variable speed of light follows from that unsynchronised display.

## Correct a received report

Suppose a remote event at fixed coordinate position $x=L>0$ sends a light signal to the origin. Reception at $t_R$ implies emission at $t_E=t_R-L/c$. For two sources at different distances, reception order need not match emission order. Reconstructing coordinate times requires geometry as well as clock readings.

As a worked example, detector B at $600\,\mathrm m$ flashes at $2\,\mu\mathrm s$ and detector C at $1500\,\mathrm m$ flashes at $0$. Using $c\simeq300\,\mathrm m/\mu\mathrm s$ for this estimate, B's report reaches the origin at $4\,\mu\mathrm s$ and C's at $5\,\mu\mathrm s$. We receive the later event first. Their separation is spacelike, but the optical-order issue itself is not the relativity of simultaneity: even observers sharing one frame need light-travel corrections.

If a particle passes two synchronised detectors, speed is $\Delta x/\Delta t$ in that detector frame. Divide distance measured in one frame by time measured in another and the result need not be a physical speed. That mixed quotient is a common source of apparent faster-than-light travel.

## Synchronised here, offset there

Two clocks A and B are at rest in $S'$, separated by proper distance $L'$ along $x'$, and synchronised in $S'$. Their display readings equal $t'$. Viewed on a common $S$-time slice, their separation is $L'/\gamma$, and

$$t'_B-t'_A=-\gamma\frac{v(x_B-x_A)}{c^2}=-\frac{vL'}{c^2}.$$

The leading clock is behind on this slice. Both clocks still run at the same rate relative to $S$, $dt'/dt=1/\gamma$ along either worldline. Rate difference and synchronisation offset answer different questions. To measure the rate, compare two events on one clock. To measure a frame's clock offset, compare events on different clocks selected by an explicit simultaneity rule.

## Source and tutorial

The primary reading is Taylor and Wheeler, [*Spacetime Physics*, chapter 2](https://www.eftaylor.com/spacetimephysics/02_chapter2.pdf), especially §§2.2–2.3 (inertial tests and locality), 2.5 (test bodies), and 2.6–2.9 (clock lattice, observers and velocities), CC BY 4.0. These notes supply original examples and equations with $c$ restored. The book's dated experimental numerical claims are not needed for the arguments here.

For your notes, draw an emission, reflection and reception diagram, then write beside each number which actual clock records it. In the tutorial, first solve the calibration problem, then compare clock lattices, then design a tolerance-based test of local inertial behaviour. A later closed-notes check should reconstruct the distinction between seeing an event and assigning its coordinates.
