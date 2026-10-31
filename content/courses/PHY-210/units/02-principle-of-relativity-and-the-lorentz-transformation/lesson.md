## From a principle to a transformation

Unit 1 asserted that the interval is invariant and used it. This unit derives the invariance from one physical principle and two thought experiments, then turns it into the Lorentz transformation, from which every "relativistic effect" follows as a corollary. Conventions as before: SI, $c$ explicit, signature $(-,+,+,+)$; a frame $S'$ moves at velocity $v$ along the $+x$ axis of frame $S$, and $\gamma = (1 - v^2/c^2)^{-1/2}$. Taylor and Wheeler write the same transformation with $c = 1$ and the opposite sign for the interval (Special Topic, Eq. L-10); Tong writes it with $\eta = \mathrm{diag}(+1,-1,-1,-1)$ (Section 7.1).

## The principle of relativity

**Definition (principle of relativity).** The laws of physics are the same in every free-float (inertial) frame; no experiment performed inside a closed laboratory can detect its uniform motion (Taylor and Wheeler, Section 3.1). Among the laws is the one fixing the speed of light in vacuum, so $c$ has the same value in every inertial frame (Section 3.3).

The book's Sections 3.2–3.3 sort quantities into those that differ between frames (velocities of objects, time separations, space separations) and those that do not (the speed of light, the order of the periodic table, Newton's first law, which is really the definition of an inertial frame).

**Result (relativity of simultaneity; Section 3.4).** Two events separated along the direction of relative motion and simultaneous in one frame are not simultaneous in another. Einstein's train: lightning strikes both ends of a moving train; the ground observer midway between the char marks receives both flashes together and calls the strikes simultaneous. The passenger midway along the train moves toward the front flash and away from the rear one, so receives the front flash first; since light has the same speed in both directions in her frame and she is equidistant from both ends, she concludes the front strike happened first. Both are right; "simultaneous" is frame-dependent. The quantitative version comes below.

**Result (invariance of transverse dimensions; Section 3.6).** Lengths perpendicular to the relative motion are the same in both frames. The book's argument is by contradiction: if a fast train were measured thinner, its wheels would fall between the rails in the ground frame but outside them in the train frame — one event cannot happen in two incompatible ways — and there is no consistent "axis of shrinkage" for two pipes sliding side by side.

## The interval is invariant: proof

**Theorem.** Under the principle of relativity (including the invariance of $c$) and the invariance of transverse dimensions, $-c^2\Delta t^2 + \Delta x^2 + \Delta y^2 + \Delta z^2$ has the same value in all inertial frames.

**Derivation (Section 3.7, the light clock).** In a rocket, a flash leaves a reference clock (event $E$), travels straight "up" a distance $h$ to a mirror, and returns to the same clock (event $R$). In the rocket frame $\Delta x' = 0$ and $c\Delta t' = 2h$. In a laboratory in which the rocket moves at speed $v$, the clock has moved $\Delta x = v\Delta t$ between the events, so the flash follows two slanted legs, each of length $\sqrt{h^2 + (\Delta x/2)^2}$ — with the same $h$, by transverse invariance — at the same speed $c$, by the principle of relativity. Hence $c\Delta t = 2\sqrt{h^2 + \Delta x^2/4}$, i.e. $c^2\Delta t^2 = 4h^2 + \Delta x^2$, and
$$-c^2\Delta t^2 + \Delta x^2 = -4h^2 = -c^2\Delta t'^2 + \Delta x'^2 .$$
The book's numbers: $h = 3\ \mathrm m$, $\Delta x = 8\ \mathrm m$, legs of $5\ \mathrm m$: rocket $(6,0)$, laboratory $(10,8)$, interval $-36\ \mathrm{m^2}$ in both (Table 3-1). Section 3.8 repeats it in a "super-rocket" frame, $(20.88, -20)$, with the same result. $\square$

The argument covers pairs of events joinable by such a flash, i.e. with one frame in which they are co-located; linearity (below) extends it to all pairs. Note where each hypothesis entered: invariance of $c$ fixed the time from the path length, transverse invariance fixed $h$.

## The Lorentz transformation

We seek the map $(t,x)\mapsto(t',x')$ between the coordinates of one event in $S$ and $S'$ (transverse coordinates are unchanged: $y' = y$, $z' = z$, Eq. L-1).

**Result (linearity; Section L.4).** The transformation is linear. A clock ticking at equal intervals in one frame must tick at equal intervals in the other, whichever tick is chosen as the reference event; a non-linear relation such as $t = Kt'^2$ would make the spacing depend on that choice. So $ct = B\,x' + D\,ct'$, $x = G\,x' + H\,ct'$ with coefficients depending only on $v$ (Eq. L-5).

**Derivation (Sections L.3 and L.5).** *Step 1: the clock at the rocket origin.* Events at $x' = 0$ have $x = vt$ in $S$. Invariance of the interval for the pair (origin event, this event) gives $-c^2t'^2 = -c^2t^2 + v^2t^2$, so $t = \gamma t'$ and $x = \gamma v t'$: hence $D = \gamma$ and $H = \gamma v/c$ (Eqs. L-3, L-4). *Step 2: a general event.* Demand $-c^2t^2 + x^2 = -c^2t'^2 + x'^2$ for all $(t',x')$:
$$-(Bx' + \gamma ct')^2 + (Gx' + \gamma\tfrac vc ct')^2 = -c^2t'^2 + x'^2 .$$
The coefficient of $x'\,ct'$ on the left is $2\gamma(-B + G\,v/c)$; it must vanish, so $B = Gv/c$. The coefficient of $x'^2$ is $G^2 - B^2 = G^2(1 - v^2/c^2) = 1$, so $G = \gamma$ and $B = \gamma v/c$ (Eqs. L-7 to L-9; the $t'^2$ coefficient then checks automatically). Therefore
$$t = \gamma\Big(t' + \frac{v x'}{c^2}\Big),\qquad x = \gamma(x' + vt'),\qquad y = y',\quad z = z',$$
and, solving (or replacing $v$ by $-v$, which is what the principle of relativity demands; Section L.6),
$$t' = \gamma\Big(t - \frac{vx}{c^2}\Big),\qquad x' = \gamma(x - vt).\qquad\square$$

Units: $vx/c^2$ is $\mathrm{m\,s^{-1}\cdot m/(m^2\,s^{-2})} = \mathrm s$, as it must be. Limiting case: for $v\ll c$, $\gamma\to 1$ and $vx/c^2\to 0$, giving the Galilean transformation $t' = t$, $x' = x - vt$; the same happens formally as $c\to\infty$.

Invariance of the interval was used twice, as the book stresses: for the clock at the origin, and for every event against the reference event.

## Everything else is a corollary

**Result (time dilation).** A clock at rest in $S'$ ($\Delta x' = 0$) ticks with $\Delta t = \gamma\Delta t'$: the proper time $\Delta t'$ is the shortest. This is unit 1's $\tau = \Delta t/\gamma$ again, now read off the transformation.

**Result (relativity of simultaneity, quantitatively).** Events simultaneous in $S$ ($\Delta t = 0$) and separated by $\Delta x$ have $\Delta t' = -\gamma v\Delta x/c^2$ in $S'$: not simultaneous, by an amount proportional to their separation along the motion. The event further ahead in the direction of motion occurs earlier in $S'$ — the train passenger's conclusion.

**Derivation (length contraction; Section 3.5).** A rod at rest in $S'$ has proper length $L_0 = x'_2 - x'_1$. To measure its length in $S$ we record the positions of its two ends *at the same $S$-time*, $t_2 = t_1$. From $x' = \gamma(x - vt)$: $L_0 = x'_2 - x'_1 = \gamma\big[(x_2 - x_1) - v(t_2 - t_1)\big] = \gamma L$, so
$$L = L_0/\gamma \le L_0 .$$
The book insists on the point that makes this a measurement and not an optical illusion: "at the same time" in $S$ is not "at the same time" in $S'$, and the two frames disagree about whether a valid length measurement took place (printed pages 63–64). Nothing contracts transversely.

**Example (numbers).** $v = 0.6c$, so $\gamma = 1.25$. An event at $(ct', x') = (4\ \mathrm m, 0)$ in the rocket is at $ct = 1.25\times 4 = 5\ \mathrm m$, $x = 1.25\times0.6\times4 = 3\ \mathrm m$ in the laboratory. Check: $-25 + 9 = -16 = -4^2$. $\checkmark$ A rod of proper length $10\ \mathrm m$ moving at $0.6c$ measures $8\ \mathrm m$; two events $8\ \mathrm m$ apart and simultaneous in the laboratory are $1.25\times0.6\times8 = 6\ \mathrm m$ of light-travel time apart in the rocket.

## The boost as a hyperbolic rotation

Since $\gamma^2 - \gamma^2v^2/c^2 = 1$, there is a unique real $\phi$ with $\gamma = \cosh\phi$ and $\gamma v/c = \sinh\phi$, i.e. $\tanh\phi = v/c$: the *rapidity*. The transformation becomes
$$\begin{pmatrix} ct' \\ x'\end{pmatrix} = \begin{pmatrix}\cosh\phi & -\sinh\phi\\ -\sinh\phi & \cosh\phi\end{pmatrix}\begin{pmatrix} ct\\ x\end{pmatrix},$$
a rotation by a hyperbolic angle that preserves $-c^2t^2 + x^2$ exactly as a Euclidean rotation preserves $x^2 + y^2$ (Tong's "rotational analogy", Section 7.3.1). Two boosts along the same axis compose by adding rapidities, $\Lambda(\phi_1)\Lambda(\phi_2) = \Lambda(\phi_1 + \phi_2)$, because the matrix is $\exp(\phi K)$ for a fixed generator $K$. Translating back,
$$\frac{w}{c} = \tanh(\phi_1 + \phi_2) = \frac{\tanh\phi_1 + \tanh\phi_2}{1 + \tanh\phi_1\tanh\phi_2},\qquad w = \frac{u + v}{1 + uv/c^2},$$
the velocity-addition law (Section L.7). Rapidities add; velocities do not, and $w < c$ whenever $u,v < c$. Limiting case: $uv \ll c^2$ gives $w\approx u + v$.

**Warning.** Lorentz contraction and the relativity of simultaneity are results of *measurements* with a lattice of synchronised clocks, not of what an eye or camera sees; light-travel delays from different parts of an object produce further distortions that the book deliberately excludes (printed page 64). **Warning.** The transformation is between inertial frames in standard configuration; a boost along $x$ composed with one along $y$ is not a pure boost (it includes a rotation). Unit 6 treats the full Lorentz group.

## What to carry forward

One principle plus two invariances (of $c$ and of transverse lengths) force the invariance of the interval; linearity plus that invariance force the Lorentz transformation; time dilation, simultaneity shifts, length contraction and velocity addition are corollaries, and the transformation is a hyperbolic rotation whose angles add. Unit 3 builds the lattice of clocks that makes "measure" precise; unit 4 draws all of this on spacetime diagrams.
