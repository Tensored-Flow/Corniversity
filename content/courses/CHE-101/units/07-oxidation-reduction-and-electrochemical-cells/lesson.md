# Redox and electrochemistry: electron balance becomes useful work

An electrochemical cell separates two coupled electron transfers so that charge can pass through an external circuit. The chemical question is not merely whether a metal “reacts”. We need the balanced reaction, the actual composition, the work available per mole of reaction, and the rate at which a real device can deliver it. These are distinct questions.

Read MIT 5.111 lecture 25, pp. 3–9, for half reactions and charge, and lecture 26, pp. 1–5, for free energy and the Nernst equation. The notes below use newly constructed examples. Some diagrams in the source have separately reserved rights; no diagram is reproduced here.

## 1. Oxidation numbers are a bookkeeping system

For an ion, the sum of formal oxidation numbers equals its charge. A rise in oxidation number is oxidation; a fall is reduction. The reducing agent is oxidised because it supplies electrons to the other reactant. Oxidation numbers need not describe literal atomic charges in a covalent molecule. In peroxide, oxygen is −1 rather than its usual −2; an average fractional oxidation number need not imply identical fractional charges on every atom.

To balance an aqueous redox reaction, first balance each half reaction: non-H/O atoms, then O with water, H with H⁺, and charge with electrons. Multiply to cancel the electrons and add. In a basic medium add equal OH⁻ to both sides to remove H⁺, then cancel water. Finally check atoms and charge independently. This is an algebraic balance; whether those chemical species remain soluble and stable at the selected pH is a further modelling question.

For example, peroxide reduction in acid is H₂O₂ + 2H⁺ + 2e⁻ → 2H₂O. Coupling it to 2I⁻ → I₂ + 2e⁻ gives H₂O₂ + 2H⁺ + 2I⁻ → I₂ + 2H₂O. Both sides carry zero total charge. Counting electrons also tells us that one mole of this reaction transfers two moles of electrons through an ideal cell.

## 2. Potentials are intensive, free energies are extensive

The anode is where oxidation occurs and the cathode is where reduction occurs, for both galvanic and electrolytic cells. Their electrical signs differ between those operating modes. For a galvanic cell, electrons travel in the wire from anode to cathode; ions in the electrolyte maintain bulk electroneutrality. Electrons do not traverse the salt bridge. A high-impedance voltmeter measures a potential difference with little current, rather than measuring current itself.

Tables conventionally give reduction potentials relative to a reference electrode. For the reaction we have selected,

$$E^\circ_{cell}=E^\circ_{cathode,red}-E^\circ_{anode,red},\qquad \Delta_rG^\circ=-nFE^\circ_{cell}.$$

Here n is the electron number in the balanced reaction and F = 96485 C mol⁻¹. A volt is J C⁻¹, so nFE has units J mol⁻¹ of reaction. Multiplying a half reaction changes its free energy and electron count, but does not multiply its potential. The sign of a single tabulated electrode potential is not by itself a spontaneity test: the paired half reaction matters.

Consider abstract couples M²⁺/M and N⁺/N with standard reduction potentials −0.40 V and +0.20 V. The balanced reaction M + 2N⁺ → M²⁺ + 2N has E° = 0.60 V, n = 2 and ΔrG° = −115.8 kJ mol⁻¹. Doubling every coefficient gives n = 4 and doubles ΔrG°, while E° remains 0.60 V. An open-circuit reversible voltage gives the maximum non-expansion electrical work per unit charge; losses under load reduce the useful output.

## 3. Derive the composition correction

For the selected reaction, ΔrG = ΔrG° + RT ln Q. Combining with ΔrG = −nFE gives

$$E=E^\circ-\frac{RT}{nF}\ln Q,\qquad \ln K=\frac{nFE^\circ}{RT}.$$

Q and K are dimensionless products of activities. Pure solids and liquids in their specified standard states have activity one. For dilute solutions we will approximate aᵢ by [i]/c°, with c° = 1 mol L⁻¹; this approximation can fail as ionic strength increases. Gas activities are approximated by partial pressure divided by the standard pressure. Never take a logarithm of a dimensional concentration.

At 298.15 K, 2.303RT/F ≈ 0.05916 V, so E = E° − (0.05916 V/n)log₁₀Q. In the abstract cell above, Q = a(M²⁺)/a(N⁺)². If these activities are 0.10 and 0.010, Q = 1000 and E ≈ 0.5113 V. The reaction remains favourable as written, but less so than at Q = 1. At Q = K, the reaction driving force and reversible cell voltage are zero. This does not mean that every microscopic electron-transfer event has stopped.

A concentration cell can produce a voltage even when E°cell = 0. Its driving force is the tendency to reduce a chemical-potential difference. Conversely E° > 0 does not guarantee E > 0 at every composition. Checking Q/K is the same thermodynamic test as checking the sign of E.

## 4. Amount, voltage and time answer different questions

For constant current I over time t, charge q = It. The amount transformed is q/(nF) mol if every electron contributes to the specified reaction. Faradaic efficiency η changes this to ηq/(nF). Capacity measures total charge available; voltage measures energy per charge; power is IV. None can replace the others. When concentration changes, the reversible voltage changes and total reversible work is an integral over charge, not necessarily the initial voltage times the full capacity.

A cell can have a favourable free energy and still deliver negligible current because electron transfer, transport, or another kinetic step is slow. Overpotentials and internal resistance matter under load. A catalyst can improve a rate or reduce kinetic losses without changing the equilibrium constant for the same overall reaction and temperature. A practical “dead” battery can reflect transport or material degradation, not just equilibrium. Our paper calculations are models of specified chemical states, not device performance claims.

## 5. How to check an electrochemical argument

Before calculating, write which reaction is forward and which activities are held fixed. After calculating, check four things: electron balance; voltage sign against Q/K; J/C and J/mol units; and the response to dilution or reversal. Reversing the reaction changes E and ΔrG signs and replaces K by 1/K. Scaling it leaves E unchanged. Those transformations expose many errors faster than repeating arithmetic.

The problem sheet develops balance, a nonstandard cell, a concentration-cell transfer, and a charge/energy synthesis. Explain each prediction in words after obtaining its number; a correct number with an inconsistent reaction convention is not a complete answer.
