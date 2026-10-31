## What this unit is for

This course begins with a diagnostic, not a lecture. The source course (MIT 5.111SC) states that it has no formal prerequisites and assumes one year of school chemistry; its lecture 1 notes assign a "Review of Fundamentals" to be done at home rather than taught in class. Corniversity does the same, but checks: the three exercises in this unit test whether that review is already in place. Nothing in a mathematics degree answers these questions, and nothing here needs more than arithmetic; what it needs is the chemist's bookkeeping. If the exercises are easy, the unit takes an evening and you move on with evidence recorded. If they are not, this lesson and the OpenStax sections it points to are the bridge, and the exercises are reattempted after the reading.

Everything in this course is virtual study of models and data. No part of it is an instruction for a laboratory.

## Counting particles: the mole

**Definition (mole).** A mole is the amount of substance containing exactly $6.02214076\times10^{23}$ specified entities (atoms, molecules, ions, electrons). The number is Avogadro's number $N_A$, with unit $\text{mol}^{-1}$ (OpenStax 3.1).

**Definition (molar mass).** The molar mass $M$ of a substance is the mass of one mole of it, in $\text{g mol}^{-1}$. For an element it is numerically the average atomic mass in u; for a compound it is the sum over the formula, so $M(\ce{H2O}) = 2(1.008) + 16.00 = 18.02\ \text{g mol}^{-1}$.

Mass $m$, amount $n$ and number of particles $N$ are linked by $n = m/M$ and $N = nN_A$. Every stoichiometric calculation passes through $n$: chemistry is bookkeeping in moles, because reactions combine particles in whole-number ratios, not grams in whole-number ratios.

**Example.** How many molecules are in $9.0\ \text{g}$ of water? $n = 9.0/18.02 = 0.50\ \text{mol}$ and $N = 0.50\times6.022\times10^{23} = 3.0\times10^{23}$ molecules. The data carried two significant figures, so the answer carries two.

## Formulas and symbols

An atom is specified by its atomic number $Z$ (protons), its mass number $A$ (protons plus neutrons) and its charge $q$. The symbol $\ce{^{A}_{Z}X^{q}}$ carries all three: neutrons number $A - Z$, and the electrons number $Z - q$, so an anion has more electrons than the neutral atom. Isotopes share $Z$ and differ in $A$ (OpenStax 2.3).

**Example.** Copper has two stable isotopes, $\ce{^{63}Cu}$ (62.93 u, 69.15%) and $\ce{^{65}Cu}$ (64.93 u, 30.85%). The average atomic mass is the abundance-weighted mean, $0.6915(62.93) + 0.3085(64.93) = 63.55$ u, which is the number printed in the periodic table and the one used in molar masses. No copper atom has that mass.

A molecular formula counts atoms per molecule ($\ce{C6H12O6}$); an empirical formula gives the smallest whole-number ratio ($\ce{CH2O}$). Ionic compounds have no molecules; their formula unit is the smallest neutral ratio of ions, so $\ce{CaCl2}$ means one $\ce{Ca^2+}$ for every two $\ce{Cl-}$ (OpenStax 2.4, 2.6). Names follow the rules in OpenStax 2.7; this course asks you to be able to read them, not to memorise them.

## Balancing: two conservation laws

**Model.** A chemical equation is a statement that atoms are conserved and that charge is conserved. Balancing means choosing the smallest whole-number coefficients that make the count of every element, and the total charge, equal on both sides (OpenStax 4.1). Coefficients multiply whole formulas. Subscripts are never changed, because changing a subscript changes which substance is meant.

**Example.** Propane burns: $\ce{C3H8 + O2 -> CO2 + H2O}$. Carbon fixes the coefficient of $\ce{CO2}$ at 3; hydrogen fixes $\ce{H2O}$ at 4; the right side then has $6 + 4 = 10$ oxygen atoms, so $\ce{O2}$ gets 5:
$$\ce{C3H8(g) + 5 O2(g) -> 3 CO2(g) + 4 H2O(l)}.$$
Count: C $3 = 3$, H $8 = 8$, O $10 = 10$. The phase labels $(s)$, $(l)$, $(g)$, $(aq)$ are part of the statement: they fix which substance is meant and, from unit 4 onwards, which energy is meant.

Charge must balance too. $\ce{Fe^3+ + e- -> Fe^2+}$ balances atoms and charge; $\ce{Fe^3+ -> Fe^2+}$ balances atoms only and is not a valid equation.

**Warning.** Balance for mass and charge before any discussion of energetics, rates or equilibrium. A rate law or an equilibrium constant written for an unbalanced equation is meaningless, and the department's conventions put balancing first for exactly that reason.

## Stoichiometry: ratios of moles

The coefficients of a balanced equation are mole ratios: in the propane equation, 1 mol $\ce{C3H8}$ reacts with 5 mol $\ce{O2}$ to give 3 mol $\ce{CO2}$ and 4 mol $\ce{H2O}$. A mass-to-mass calculation is always the same three steps: mass to moles, mole ratio, moles to mass (OpenStax 4.3).

**Example.** Mass of $\ce{CO2}$ from burning $4.40\ \text{g}$ of propane ($M = 44.10\ \text{g mol}^{-1}$): $n(\ce{C3H8}) = 0.0998\ \text{mol}$; $n(\ce{CO2}) = 3\times0.0998 = 0.299\ \text{mol}$; $m = 0.299\times44.01 = 13.2\ \text{g}$. The check that costs nothing and catches most errors: the total mass of products equals the total mass of reactants, because atoms were conserved.

**Definition (limiting reactant).** When reactants are not supplied in the stoichiometric ratio, the one used up first is the limiting reactant; it fixes the theoretical yield, and the others are in excess (OpenStax 4.4). Find it by comparing the amount of each reactant with the amount the balanced equation would need; never compare masses.

**Definition (percent yield).** $\text{percent yield} = \dfrac{\text{actual yield}}{\text{theoretical yield}}\times100\%$. A yield above 100% signals an error or an impure product, never a better reaction.

**Example.** $\ce{2 Al(s) + 3 Cl2(g) -> 2 AlCl3(s)}$ with 1.00 mol Al and 1.00 mol $\ce{Cl2}$. Consuming all the Al would need 1.50 mol $\ce{Cl2}$; only 1.00 mol is present, so $\ce{Cl2}$ limits, giving $\tfrac{2}{3}(1.00) = 0.667$ mol $\ce{AlCl3}$ and leaving $1.00 - 0.667 = 0.333$ mol Al unreacted.

## Solutions: molarity

**Definition (molarity).** $c = n/V$, the amount of solute per litre of solution, in $\text{mol L}^{-1}$ (written M). The volume is that of the final solution, not of the solvent added (OpenStax 3.3). Diluting changes the volume and the concentration but not the amount of solute, so $c_1V_1 = c_2V_2$.

**Example.** $10.1\ \text{g}$ of $\ce{KNO3}$ ($M = 101.1\ \text{g mol}^{-1}$) made up to $500.0\ \text{mL}$: $n = 0.0999\ \text{mol}$, $c = 0.0999/0.5000 = 0.200\ \text{M}$. Taking $25.0\ \text{mL}$ of this to $100.0\ \text{mL}$ gives $0.200\times25.0/100.0 = 0.0500\ \text{M}$. Each formula unit supplies one $\ce{K+}$ and one $\ce{NO3-}$, so each ion is also $0.0500\ \text{M}$.

## Stating assumptions

A chemistry answer is a number with units, a phase for every substance and a statement of what was assumed. In this unit the assumptions are mild: pure substances, reactions that go to completion as written, volumes measured as stated, atomic masses as given. Later units add temperature, pressure and standard states. Begin the habit now, and write the assumption even when it seems obvious, because the tutor will ask what changes if it fails.

## What the diagnostic tells you

Exercise 1 tests balancing and mass-to-mass stoichiometry with a mass-balance check; exercise 2 tests limiting reactant and yield; exercise 3 tests atomic symbols, isotopic averaging and molarity through a dilution. Accepted attempts on all three are the evidence that satisfies the course's entry rule. If one is not accepted, the feedback says which step failed and the matching OpenStax section is the reading for a second attempt. This is diagnosis, not a grade.
