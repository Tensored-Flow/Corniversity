# Solve the collision with the invariant first

A collision may involve several unknown velocities, but the total four-momentum often supplies the answer before those velocities are found. Choose a complete system, write $P_{\rm in}=P_{\rm out}$, and square a useful combination. With our signature $(-,+,+,+)$, a particle of mass $m$ has $P^2=-m^2c^2$. To avoid sign confusion, define the positive energy-squared invariant

$$s=-c^2P_{\rm tot}^2=E_{\rm tot}^2-c^2|\mathbf p_{\rm tot}|^2.$$

This $s$ is a particle-physics convention, not the spacetime interval $\Delta s^2$ from unit 1. Its square root is the total energy in the centre-of-momentum frame when that frame exists.

## Thresholds and the cost of recoil

For projectile mass $m_a$, laboratory total energy $E_a$, and target mass $m_b$ initially at rest,

$$s=m_a^2c^4+m_b^2c^4+2m_bc^2E_a.$$

For an endothermic production channel with at least two final particles and $M_f\ge m_a+m_b$, the kinematic threshold has total final rest mass $M_f=\sum_i m_i$, and their relative kinetic energies vanish in the centre-of-momentum frame, so $s_{\rm th}=M_f^2c^4$. Hence

$$E_{a,\rm th}=\frac{M_f^2-m_a^2-m_b^2}{2m_b}c^2.$$

This is projectile total energy; subtract $m_ac^2$ to obtain kinetic energy. The formula gives a kinematic lower bound assuming the listed particles and conservation laws permit the reaction. Dynamics, quantum numbers and available phase space decide whether a process occurs and with what rate. For massless final particles, 'all at rest' is not literal; the minimum may be a limiting infimum rather than a finite all-rest configuration.

**Worked fixed-target comparison.** In a hypothetical allowed reaction, a projectile of mass $m$ hits a stationary mass $m$ and produces three particles each of mass $m$. Then $M_f=3m$, $E_{a,\rm th}=7mc^2/2$, and kinetic threshold $T_{a,\rm th}=5mc^2/2$. Merely supplying the additional rest energy $mc^2$ is insufficient because the final system must carry the initial nonzero momentum. In a symmetric collider, equal and opposite beams have zero total momentum, so each projectile needs energy $3mc^2/2$ at threshold. The total beam kinetic energy is then $mc^2$. This comparison is kinematic, not a claim that every hypothetical reaction respects particle quantum numbers.

A single photon in empty space cannot become an isolated massive pair: its initial $s=0$, while the pair has positive invariant mass. A target can take recoil. For $\gamma+M\to M+m+m$, neglecting binding changes,$s=M^2c^4+2Mc^2E_\gamma$. The exercise derives the threshold and shows why an infinitely heavy target is a useful limit rather than an exact finite-target answer.

## Two-body decay without solving two velocities

Let a parent at rest of mass $M$ decay into masses $m_1,m_2$. Momentum conservation gives opposite momenta of equal magnitude $p$. Write $P_2=P-P_1$ and square:

$$-m_2^2c^2=-M^2c^2-m_1^2c^2+2ME_1.$$

Therefore

$$E_1=\frac{M^2+m_1^2-m_2^2}{2M}c^2,\qquad E_2=\frac{M^2+m_2^2-m_1^2}{2M}c^2.$$

Then $p=\sqrt{E_1^2/c^2-m_1^2c^2}$ and $v_i=pc^2/E_i$. For two massive daughters a kinematically allowed decay needs $M\geq m_1+m_2$; equality has zero relative momentum and may have vanishing decay phase space. Positive excess mass can become daughter kinetic energy. Conservation alone does not supply the decay lifetime or angular distribution.

If both daughters are photons, each has energy $Mc^2/2$ in the parent rest frame and they emerge back to back. A boosted observer generally measures unequal photon energies. The pair invariant still reconstructs M:

$$M^2c^4=2E_1E_2(1-\cos\theta),$$

where $\theta$ is the angle between the laboratory photon directions. Collinear photons moving together have zero total invariant mass; opposing photons do not. Always add vectors before squaring.

## Compton scattering: use the recoil mass shell

An initial electron is at rest, an incident photon has energy E, and the scattered photon has energy $E'$ at angle $\theta$. Write electron momentum $p$, photon momenta $k,k'$, and final electron momentum $p'=p+k-k'$. Since $p'^2=p^2=-m_e^2c^2$ and $k^2=k'^2=0$,

$$2p\cdot(k-k')-2k\cdot k'=0.$$

Here $p\cdot k=-m_eE$, $p\cdot k'=-m_eE'$, and $k\cdot k'=-EE'(1-\cos\theta)/c^2$. Rearranging gives

$$E'=\frac{E}{1+(E/m_ec^2)(1-\cos\theta)}.$$

The electron recoil receives energy $E-E'$, so the photon cannot gain energy from an initially stationary free electron in this model. For forward scattering $E'=E$. At low incident energy the fractional shift is small. Using $E=hc/\lambda$ also gives $\lambda'-\lambda=(h/m_ec)(1-\cos\theta)$. This idealisation treats the electron as free and initially at rest; bound-electron and moving-target effects require a different model.

**Worked recoil check.** For $E=2m_ec^2$ and $\theta=90^\circ$, $E'=2m_ec^2/3$. The electron receives $4m_ec^2/3$ kinetic energy. If the incident direction is $+x$ and the outgoing photon direction $+y$, its momentum is $(2,-2/3,0)m_ec$. The final electron mass shell reads $(7/3)^2-[4+4/9]=1$, confirming the calculation.

## Binding energy and joules

For a reaction compared in a consistent rest-mass convention, define $Q=(\sum m_{\rm initial}-\sum m_{\rm final})c^2$. Positive Q is the available energy release into final kinetic energy and radiation, not necessarily usable electrical output. Atomic masses and bare nuclear masses cannot be mixed without accounting for electrons. Fusion of light nuclei and fission of heavy nuclei can both release energy by reaching more tightly bound configurations; the reverse reaction requires the energy back. There is no cycle that releases Q in both directions while restoring every initial state.

As an original scale calculation, a specified mass deficit $\Delta m=3.0\times10^{-29}\,\mathrm{kg}$ corresponds to $Q=\Delta mc^2\simeq2.70\times10^{-12}\,\mathrm J$ per event, or about 16.8 MeV using $1\,\mathrm{eV}=1.602176634\times10^{-19}\,\mathrm J$. At $10^{15}$ events per second the ideal released power is about 2.70 kW. These are supplied hypothetical reaction data, not a prediction of a particular reactor's yield or efficiency.

## Sources, scope and final checks

Taylor and Wheeler, [chapter 8](https://www.eftaylor.com/spacetimephysics/08_chapter8.pdf), §§8.3–8.7, is the primary account of system mass, photons, threshold recoil and released energy (CC BY 4.0). Tong's [§7.5](https://davidtong.org/pdfs/teaching/dynamics-and-relativity/dynrel7.pdf) is a reference-only second account of invariant methods. Its printedp.146 statement that the Higgs mostly decays to two photons is incorrect: the diphoton channel is rare; bottom-quark pairs dominate ([CERN overview](https://home.web.cern.ch/science/physics/higgs-boson/ten-years/)). The two-photon kinematics remains useful, but a possible channel is not a dominant channel. We make no branching-ratio prediction from four-momentum conservation.

The problem sheet asks for thresholds, decay, recoil and an energy budget. For each, distinguish total from kinetic energy, show at least one invariant check, and state what conservation does not determine. Those habits are more reusable than memorising separate formulae for every named process.
