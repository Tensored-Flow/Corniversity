## Two ways to reach a closed shell

Unit 2 ended with atoms whose outer electrons are more or less tightly bound. Bonding is what those atoms do about it. Lecture 9 of the source course puts it as two limiting cases. In an **ionic bond** an atom of low ionisation energy gives an electron to an atom of high electron affinity; the resulting ions, $\ce{Na+}$ ($[\text{Ne}]$) and $\ce{Cl-}$ ($[\text{Ar}]$), attract by Coulomb's law and pack into a lattice. In a **covalent bond** two atoms share electrons so that each reaches a noble-gas configuration. Between the limits lie **polar covalent** bonds, shared unequally.

**Definition (electronegativity).** A measure of how strongly an atom in a molecule attracts the shared electrons (OpenStax 7.2). It rises across a period and falls down a group, so fluorine is the most electronegative element. The difference $\Delta\chi$ between two bonded atoms is the usual guide: near zero, covalent ($\ce{Cl-Cl}$); moderate, polar covalent ($\ce{H-Cl}$, with partial charges $\delta+$ on H and $\delta-$ on Cl); large, ionic ($\ce{NaCl}$). The boundaries are conventions, not laws; electronegativity is a model quantity, and the measurable things are dipole moments and lattice energies (OpenStax 7.5 treats the Born–Haber cycle, which this course leaves as reading).

## Lewis structures: counting electrons

**Model.** G. N. Lewis's picture (lecture 10): valence electrons are either bonding pairs or lone pairs, and each atom aims for eight around it, the **octet rule**, with hydrogen content at two. A Lewis structure is built by counting:

1. Write the skeleton (the least electronegative atom, other than H, is usually central).
2. Count the valence electrons, adjusting for charge: add one per negative charge, subtract one per positive charge.
3. Count the electrons needed for full shells (8 per atom, 2 per H); the difference between step 3 and step 2 is the number of bonding electrons.
4. Place two bonding electrons per bond; if bonding electrons remain, make double or triple bonds.
5. Place the remaining electrons as lone pairs to complete octets.
6. Compute formal charges.

**Definition (formal charge).** For each atom, $\text{FC} = V - L - \tfrac12 B$, where $V$ is the number of valence electrons of the free atom, $L$ the number of lone-pair electrons on the atom and $B$ the number of bonding electrons it shares (lecture 10, page 3). The formal charges must sum to the total charge of the species; this is a check you run every time. Formal charge is not oxidation number.

**Example.** Carbonate, $\ce{CO3^2-}$. Valence electrons: $4 + 3(6) + 2 = 24$. Full shells: $4\times8 = 32$. Bonding electrons: $32 - 24 = 8$, four bonds, so one C=O double bond and two C–O single bonds. The remaining $24 - 8 = 16$ electrons are eight lone pairs on the oxygens. Formal charges: C, $4 - 0 - 4 = 0$; the double-bonded O, $6 - 4 - 2 = 0$; each single-bonded O, $6 - 6 - 1 = -1$. Sum: $-2$, as it must be.

Which oxygen gets the double bond? Any of them, and that is the point. **Resonance structures** are two or more valid Lewis structures with the same arrangement of atoms and different arrangements of electrons; the real ion is the **resonance hybrid**, in which the electrons are delocalised over all three bonds (lecture 10, pages 4–5). Measured carbonate has three equal C–O bonds, each of bond order $\tfrac{4}{3}$ (four bonding pairs shared over three bonds), intermediate between single and double. A single structure predicts one short and two long bonds; that prediction is wrong, and resonance is the correction.

When several structures have the same atoms but different formal charges, prefer the one with the smallest magnitudes, and with negative formal charge on the more electronegative atom (lecture 10, page 4; OpenStax 7.4).

**Warning.** Three classes of molecule break the octet rule (lecture 11; OpenStax 7.3): odd-electron radicals such as $\ce{NO}$, electron-deficient molecules such as $\ce{BF3}$ (six electrons on boron), and hypervalent molecules such as $\ce{SF6}$ and $\ce{PCl5}$, whose central atom is in period 3 or below. A second-period atom (C, N, O, F) never has more than eight electrons around it; a structure that gives nitrogen ten is rejected however neat its formal charges.

## VSEPR: from electron pairs to shape

**Model.** Valence-shell electron-pair repulsion (lecture 12; OpenStax 7.6): regions of electron density around a central atom, bonding or non-bonding, arrange themselves to be as far apart as possible. A multiple bond counts as one region. Write $\ce{AX_mE_n}$ for a central atom A with $m$ bonded atoms and $n$ lone pairs; the **steric number** $m + n$ fixes the electron-pair geometry: 2 linear, 3 trigonal planar, 4 tetrahedral, 5 trigonal bipyramidal, 6 octahedral. The **molecular shape** names only the positions of the atoms.

Lone pairs are held by one nucleus rather than two and spread out more, so the repulsions rank lone pair–lone pair > lone pair–bond pair > bond pair–bond pair (lecture 12, page 3). Two consequences: lone pairs take the roomier positions (equatorial in a trigonal bipyramid, opposite each other in an octahedron), and they compress the angles between bonds.

**Example.** $\ce{H2O}$ is $\ce{AX2E2}$: tetrahedral electron-pair geometry, bent shape, angle below $109.5^\circ$ (about $104.5^\circ$). $\ce{CH4}$ is $\ce{AX4}$, tetrahedral, $109.5^\circ$. $\ce{PCl5}$ is $\ce{AX5}$, trigonal bipyramidal, with $90^\circ$ and $120^\circ$ angles. $\ce{SF6}$ is $\ce{AX6}$, octahedral. $\ce{XeF2}$ is $\ce{AX2E3}$: the three lone pairs take the three equatorial positions and the molecule is linear. $\ce{BF3}$ is $\ce{AX3}$, trigonal planar, $120^\circ$. If a molecule has resonance structures, VSEPR applies to any one of them, since the shape depends on the number of electron regions, not on where the double bond is drawn (lecture 12, page 2).

**Definition (molecular polarity).** A bond between atoms of different electronegativity has a dipole; the molecule's dipole moment is the vector sum of its bond dipoles. In the symmetric shapes without lone pairs, and in square planar $\ce{AX4E2}$ and linear $\ce{AX2E3}$, the bond dipoles cancel: $\ce{CCl4}$ and $\ce{BF3}$ are nonpolar although every bond is polar. $\ce{H2O}$ is polar because the bent shape leaves a net dipole (OpenStax 7.6).

What VSEPR does not give: bond energies, bond lengths, or anything about how a multiple bond differs from a single one (lecture 12, page 7). For those we need orbitals.

## Molecular orbitals

**Model.** Combine atomic orbitals on two atoms into molecular orbitals spread over both (lecture 13; OpenStax 8.4). Two $1s$ orbitals give a **bonding** $\sigma_{1s}$ orbital (constructive overlap, lower in energy) and an **antibonding** $\sigma^*_{1s}$ orbital (a node between the nuclei, higher in energy). Electrons fill molecular orbitals by the same aufbau, Pauli and Hund rules as in atoms.

**Definition (bond order).** $\text{bond order} = \tfrac12(\text{bonding electrons} - \text{antibonding electrons})$. A bond order of zero means no bond.

**Example.** $\ce{H2}$: $(\sigma_{1s})^2$, bond order 1. $\ce{He2}$: $(\sigma_{1s})^2(\sigma^*_{1s})^2$, bond order 0, which is why helium is monatomic. For second-period diatomics the $2s$ orbitals give $\sigma_{2s}$ and $\sigma^*_{2s}$, and the $2p$ orbitals give one $\sigma_{2p}$, two degenerate $\pi_{2p}$, two degenerate $\pi^*_{2p}$ and one $\sigma^*_{2p}$. For $\ce{O2}$ and $\ce{F2}$ the $\sigma_{2p}$ lies below the $\pi_{2p}$; for the lighter diatomics the order of those two is swapped. $\ce{N2}$ (10 valence electrons) has bond order $\tfrac12(8 - 2) = 3$ with all electrons paired, matching its triple bond and great stability. $\ce{F2}$ (14 valence electrons) has bond order 1.

Here is the fact that motivates the whole theory: liquid oxygen is attracted into a magnetic field, so $\ce{O2}$ has unpaired electrons, yet its Lewis structure $\ce{O=O}$ pairs every electron. Exercise 3 asks you to fill the MO diagram for $\ce{O2}$ and its ions and resolve this.

## Valence bond theory and hybridisation

The MO picture is delocalised; chemists also want a local picture of each bond. **Valence bond theory** describes a bond as the overlap of two half-filled orbitals, head-on for a $\sigma$ bond and side-on for a $\pi$ bond; a double bond is one $\sigma$ plus one $\pi$, a triple bond one $\sigma$ plus two $\pi$ (OpenStax 8.1). To get the right angles the atomic orbitals are mixed into **hybrid orbitals**: $sp^3$ for tetrahedral electron-pair geometry ($\ce{CH4}$, and the oxygen in $\ce{H2O}$), $sp^2$ for trigonal planar ($\ce{BF3}$, the carbons of ethene, each with one unhybridised $p$ orbital left for the $\pi$ bond), $sp$ for linear ($\ce{CO2}$, ethyne) (lecture 14; OpenStax 8.2). Hybridisation is assigned from the electron-pair geometry that VSEPR gives, never the other way round; it is a description, not a cause.

## What to carry forward

Count electrons, check formal charges sum to the charge, draw all resonance forms. Shape follows from electron regions, polarity from shape plus electronegativity. Bond order and magnetism come from molecular orbitals, which succeed exactly where Lewis structures fail. Next unit: the energies of these bonds, and how energy and entropy together decide which reactions go.
