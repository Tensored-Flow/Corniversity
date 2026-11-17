# Read a spacetime diagram as geometry

Put $x$ horizontally and $ct$ vertically, using equal scales. A worldline then records both where an object is and when it is there. Its tangent encodes velocity: $v/c=dx/d(ct)$. A vertical line is a body at rest in this frame; a light ray has slope $\pm1$; a massive particle's future-directed worldline stays inside the local light cone. A curved line on this diagram means changing velocity. It says nothing by itself about curvature of spacetime.

Our interval is $ds^2=-c^2dt^2+dx^2$ in 1+1 dimensions. Taylor and Wheeler use $c^2dt^2-dx^2$ for the positive squared proper-time interval. Keep that translation visible beside the diagram. Ordinary ruler length on the page uses a sum of squares and is not the Lorentzian length of a worldline.

## Tilted axes need their own calibration

For $S'$ moving with speed $v=\beta c$ along $+x$, the $ct'$ axis is $x=\beta ct$, because it is the worldline $x'=0$. The $x'$ axis is $ct=\beta x$, because it is the simultaneity line $t'=0$. These axes tilt toward the light rays; they are not an ordinary Euclidean rotation.

To mark one unit of $ct'$ along the new time axis, intersect it with $c^2t^2-x^2=1$ in the chosen length units. To mark one unit of $x'$, intersect its axis with $x^2-c^2t^2=1$. An ordinary ruler along the tilted axis gives the wrong calibration. In general the unit time-axis point is $(ct,x)=(\gamma,\gamma\beta)$ and the unit space-axis point is $(\gamma\beta,\gamma)$.

**Worked diagram.** At $\beta=3/5$, these points are $(5/4,3/4)$ and $(3/4,5/4)$. Their Lorentz squares are $-1$ and $+1$, and their Lorentz inner product is zero. Their Euclidean dot product is not zero. The two notions of orthogonality differ because the metric differs. Reading a coordinate means projecting parallel to the other primed axis, not dropping a Euclidean perpendicular.

## Add the elapsed times, not the endpoint distances

For a piecewise inertial trip, the ideal carried clock reads

$$\tau=\sum_i\sqrt{\Delta t_i^2-\Delta x_i^2/c^2}.$$

For a smooth timelike worldline this becomes

$$\tau=\int_{t_A}^{t_B}\sqrt{1-v(t)^2/c^2}\,dt.$$

The interval between endpoints alone supplies the proper time of the straight inertial route joining them. It does not give the elapsed time on every possible route. Each route's proper time is invariant, but different routes can have different proper times. Invariance means independence of coordinate description, not independence of the physical path.

Why is the inertial route longest? Transform to the frame in which the timelike-separated endpoints occur at the same spatial position. The straight route stays there and reads $T=t_B-t_A$. Every other future-directed timelike route obeys $d\tau\leq dt$, hence $\tau\leq T$. Equality requires $v=0$ almost everywhere, so a nontrivial excursion has strictly less proper time. This is a global result in Minkowski spacetime. The analogous assertion needs qualifications in curved spacetime and is not established by this proof.

**Worked broken path.** Use years and light-years, so $c=1$ as a conversion between those units. Travel from $A=(0,0)$ to $B=(5,3)$ and then $C=(10,0)$, where entries are $(t,x)$. Each leg gives $\sqrt{25-9}=4$ years of proper time. The traveller reads 8 years and an Earth clock reads 10 years. The number 8 does not change when a different inertial frame describes all three events.

## The twin comparison in both frames

During the outward leg at $v=3c/5$, the traveller can use an outgoing inertial frame. At turnaround $(t,x)=(5,3)$, an Earth event $(t_E,0)$ is simultaneous in that frame if $t_E=5-(3/5)3=3.2$ years. For the incoming frame with velocity $-3c/5$, the simultaneous Earth event is instead $t_E=5+(3/5)3=6.8$ years. Changing frames changes which distant Earth event is assigned 'now'. It does not make a physical Earth clock jump.

On either leg Earth clocks run at rate $1/\gamma=4/5$ relative to the appropriate traveller coordinate time. The two 4 year traveller legs therefore account for 3.2 years of Earth time each, plus the 3.6 year change in the distant simultaneity assignment, totalling 10 years. No single inertial traveller frame covers both legs. That is the missing premise in the tempting argument that each twin must age less than the other.

The instantaneous turnaround is an idealisation. Unit 9 replaces it with finite acceleration and a smooth worldline. The fundamental explanation remains the proper-time integral. A rapidly changing velocity does not require general relativity; nor do we introduce a mysterious acceleration penalty into the clock formula.

## Signals add another layer

The traveller may send regular flashes, but Earth receives them at rates affected by both clock time dilation and changing distance. For emission intervals $d\tau$ on a source receding at speed $v$, laboratory emissions are separated by $dt=\gamma d\tau$, and the extra travel distance is $vdt$. Thus the reception interval is $dt_R=\gamma(1+\beta)d\tau$. The received frequency factor is $1/[\gamma(1+\beta)]=\sqrt{(1-\beta)/(1+\beta)}$. During approach replace $\beta$ by $-\beta$.

This Doppler factor is not the time-dilation factor alone. It also explains why changing the traveller's simultaneity convention does not produce an instantaneous visible jump in a distant clock. Signals still take time to arrive.

## Reading and work

Taylor and Wheeler, [chapter 5](https://www.eftaylor.com/spacetimephysics/05_chapter5.pdf), §§5.2–5.8, develops diagrams, hyperbolae and accumulated clock time; [chapter 4](https://www.eftaylor.com/spacetimephysics/04_chapter4.pdf), §§4.6–4.9, compares twins using separate outbound and inbound frames (CC BY 4.0). The calculations here are original. The book's old claim that neutrinos are examples of exactly lightlike particles should not be adopted; the null paths in our diagrams represent vacuum light signals.

Draw each tutorial path before calculating. Mark the actual reunion events, the two simultaneity lines at turnaround, and the light signals separately. Then ask which statements depend on a frame and which are invariant statements about the path.
