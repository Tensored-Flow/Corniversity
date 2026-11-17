# Coordination chemistry: infer structure from several kinds of evidence

A transition-metal complex is an opportunity to connect ideas that can otherwise feel separate: Lewis acid–base bonding, electron count, geometry, spectra, magnetism and equilibrium. The goal is not to memorise one colour per metal. It is to state a model, derive what that model predicts, and decide which observations actually distinguish competing structures.

Read MIT 5.111 lectures 27–29 alongside these notes. Lecture 27 introduces ligands and electron counting; lecture 28 develops octahedral splitting; lecture 29 changes the geometry. The simple crystal-field model is a useful first model, but several source examples are teaching simplifications. We state those limits explicitly.

## 1. Count charge, donor atoms and electrons separately

A ligand donates electron density to a metal centre. A monodentate ligand binds through one donor atom; a bidentate ligand binds through two. The coordination number counts directly attached donor atoms, not the number of ligand molecules when those differ. Three bidentate ethylenediamine ligands therefore give coordination number six. Counterions outside the square brackets contribute to the salt's neutrality but are not automatically metal-bound ligands.

For [Co(en)₃]Cl₃, en is neutral and each chloride is −1. The bracketed ion has charge +3, so cobalt is formally +3. Cobalt is in group 9; its formal d count is 9−3=6. This ionic counting rule is useful for ordinary d-block complexes, though strongly covalent or redox-active ligands can make the assignment less straightforward. A formal d⁶ count is a bookkeeping result, not a measurement of six electrons localised exclusively on cobalt.

Coordination number does not uniquely determine geometry. Four-coordinate complexes may be tetrahedral or square planar; six-coordinate complexes are often approximately octahedral. A square-planar MA₂B₂ complex has cis and trans arrangements. An octahedral complex with chelating ligands may have non-superimposable mirror forms. Drawing donor positions makes these statements precise; a molecular formula alone cannot encode all of them.

## 2. Derive the octahedral energy levels

Place six point-charge ligands along ±x, ±y and ±z. The d(x²−y²) and d(z²) orbitals point strongly toward these directions and have higher energy in the electrostatic model than d(xy), d(xz), d(yz). The higher pair is called e_g and the lower triplet t₂g. Let their separation be Δₒ and choose the weighted mean energy as zero. If the lower energy is a and the higher b, then b−a=Δₒ and 3a+2b=0. Hence

$$a=-\frac25\Delta_o,\qquad b=+\frac35\Delta_o.$$

This zero is a reference for splitting within the d shell. A negative crystal-field stabilisation energy does not by itself give the whole complex formation energy. Metal–ligand bonding, solvation, entropy, electron pairing and other contributions remain.

For n_t lower and n_e upper electrons, CFSE = (−0.4n_t+0.6n_e)Δₒ. Within a degenerate set, put electrons singly with parallel spins before pairing. But when choosing between a lower paired orbital and a higher unoccupied orbital, compare splitting with pairing cost. For octahedral d⁶, high spin is t₂g⁴e_g²: four unpaired electrons and CFSE = −0.4Δₒ. Low spin is t₂g⁶: zero unpaired and CFSE = −2.4Δₒ. In a model charging P per doubly occupied orbital, high spin has one pair and low spin three, so E_LS−E_HS = −2Δₒ+2P. Low spin wins when Δₒ>P under this simplified comparison.

Do not add a pairing term twice when a quoted “stabilisation energy” already includes it. Also do not assume that every d count has distinct high- and low-spin octahedral configurations. For example, ordinary octahedral d³ fills t₂g³ with three unpaired electrons in either weak or strong fields.

## 3. What magnetism can tell us

Unpaired electrons generally produce paramagnetism; a closed-shell complex is diamagnetic. In the spin-only approximation, the effective moment is μ_eff≈√[n(n+2)] μ_B for n unpaired electrons. For n=4 this is √24≈4.90 μ_B. This approximation can be imperfect when orbital angular momentum, spin–orbit coupling, interactions between centres, or temperature-dependent populations matter. Measured magnetism constrains an electronic model; it is not a universal geometry detector.

A d⁸ ion in an ideal octahedral field has t₂g⁶e_g², usually two unpaired electrons. A sufficiently split square-planar d⁸ configuration can pair all eight electrons in four lower orbitals, leaving d(x²−y²) empty. Diamagnetism would favour that square-planar model over the elementary octahedral alternative, given those assumptions. It would still be sensible to seek diffraction or spectroscopic evidence before claiming a unique molecular structure.

## 4. Geometry changes the splitting, not just the labels

In a tetrahedral field, ligands point between the coordinate axes. The pair e lies lower and the triplet t₂ higher. With the same barycentre convention, their energies are −0.6Δₜ and +0.4Δₜ. There is no g subscript because tetrahedral geometry lacks an inversion centre. The splitting is often small enough that ordinary tetrahedral complexes are high spin, but this is a common tendency rather than a logical law for every conceivable complex.

Square-planar splitting has more than two levels. A diagram specifying their relative energies is needed for an actual filling calculation; applying the octahedral −0.4/+0.6 formula to square-planar orbitals has no justification. Ligand type, metal identity, oxidation state and bond distances also influence splittings. A ligand ordering learned for one family is a guide, not a complete quantitative prediction for every system.

## 5. Spectra connect quantum energy and visible observation

An absorbed photon has energy E=hν=hc/λ. If a specified transition is approximated by Δₒ, a molar splitting requires conversion to energy per complex: λ=hcN_A/Δₒ,molar. For Δ=200 kJ mol⁻¹, λ≈598 nm. Increasing the splitting decreases the absorbed wavelength. The perceived transmitted colour depends on what wavelengths remain, not on calling the absorbed wavelength the sample's colour.

Real complexes can have several allowed or weak transitions; d–d selection rules, charge-transfer transitions, ligand absorption, concentration and path length all matter. A d⁰ or d¹⁰ complex lacks ordinary d–d transitions, but it can still be coloured by other processes. A single absorption band therefore does not prove a unique geometry or even a pure d–d assignment. Our numerical exercises explicitly stipulate when a one-gap approximation is intended.

## 6. Connect structure to equilibrium

Chelating ligands often form more stable complexes than comparable monodentate ligands. Release of several bound solvent molecules and the organisation of the ligand can contribute to this chelate effect, but “more particles” is not a universal proof of a favourable ΔG. Protonation, solvation and enthalpy can matter. Formation constants describe specified reactions and conditions. A strong thermodynamic complex may also exchange ligands slowly; stability and kinetic inertness are different claims.

On this sheet, combine charge and d counts before filling orbitals. When using a measurement to infer structure, state at least one alternative explanation and one further discriminating measurement. That is the difference between applying a diagram and doing an evidence-based chemical argument.
