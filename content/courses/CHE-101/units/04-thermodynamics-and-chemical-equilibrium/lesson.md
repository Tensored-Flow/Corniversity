## Will it, and how far?

The source course opens its third unit with a question: will they or won't they? Thermodynamics answers whether a reaction can proceed and how far it goes; it says nothing about how fast (lecture 15, page 1). Kinetics, unit 5, answers the speed question. Keep the two apart from the start: under ordinary ambient conditions diamond is metastable relative to graphite but can persist for extremely long times because conversion is kinetically hindered.

## Heat, enthalpy and standard states

**Definition (enthalpy).** $H = U + PV$. For a process at constant pressure with only expansion work, the heat absorbed equals the enthalpy change, $q_P = \Delta H$. Enthalpy is a state function: $\Delta H$ depends only on the initial and final states, not on the path (OpenStax 5.3). Exothermic processes have $\Delta H < 0$, endothermic $\Delta H > 0$.

**Definition (standard state).** Standard states are specified reference states: an ideal gas at standard pressure 1 bar, a pure condensed substance in the specified phase at that pressure, or a solute in its chosen hypothetical unit-activity reference state (here based on 1 M). The most stable elemental form at the stated temperature and standard pressure is the reference convention for zero elemental formation enthalpy, not the definition of every substance’s standard state. The degree sign in $\Delta H^\circ$ means every species is in its standard state; the temperature is not part of the definition and must be stated, with 298.15 K the convention for tables (lecture 15, pages 2–3; OpenStax 5.3). The phase is part of the state: $\ce{H2O(l)}$ and $\ce{H2O(g)}$ differ by the enthalpy of vaporisation, 44.0 kJ/mol at 298 K.

There are three ways to get $\Delta H^\circ_r$ for a reaction (lecture 15, pages 3–4).

**Model (bond enthalpies).** Breaking a bond costs energy; forming one releases it. With mean bond enthalpies $\Delta H_B$,
$$\Delta H^\circ_r \approx \sum_{\text{bonds broken}} \Delta H_B - \sum_{\text{bonds formed}} \Delta H_B .$$
Mean bond enthalpies average over different gaseous molecular environments. They provide an approximate gas-phase estimate, with no universal percentage error bound; the relative error can be especially large when the reaction enthalpy is small.

**Example.** $\ce{H2(g) + Cl2(g) -> 2 HCl(g)}$ with mean bond enthalpies H–H 436, Cl–Cl 243, H–Cl 432 kJ/mol (values used for this example): broken $436 + 243 = 679$, formed $2\times432 = 864$, so $\Delta H^\circ_r \approx -185$ kJ/mol. Two moles of HCl are formed, so this is $-92.5$ kJ per mole of HCl, close to the tabulated enthalpy of formation of HCl(g), $-92.3$ kJ/mol. The gas-phase restriction is satisfied, and these supplied values happen to give close agreement; that is not a general accuracy guarantee.

**Definition (enthalpy of formation).** $\Delta H^\circ_f$ of a compound is $\Delta H^\circ$ for forming one mole of it from its elements in their designated reference forms at the stated temperature and standard pressure; the formation enthalpy of each designated elemental reference form is zero. Then
$$\Delta H^\circ_r = \sum \nu\,\Delta H^\circ_f(\text{products}) - \sum \nu\,\Delta H^\circ_f(\text{reactants}),$$
with the stoichiometric coefficients $\nu$. This is exact for the tabulated phases.

**Example.** $\ce{2 H2O2(l) -> 2 H2O(l) + O2(g)}$ with $\Delta H^\circ_f(\ce{H2O2}, l) = -187.8$ and $\Delta H^\circ_f(\ce{H2O}, l) = -285.8$ kJ/mol: $\Delta H^\circ_r = 2(-285.8) - 2(-187.8) = -196.0$ kJ/mol. The notes quote the same value for this reaction (lecture 16, page 3).

**Hess's law** is the state-function property in use: if equations add to give a target equation, their $\Delta H^\circ$ values add the same way (lecture 15, page 4). The formation route is Hess's law with a particular choice of steps.

## Entropy and the second law

**Definition (entropy).** $S = k\ln W$ for an equiprobable ensemble of $W$ accessible microstates (OpenStax 16.2). Producing gas or increasing gas-particle number often suggests a positive entropy change, and melting usually increases entropy, but these are qualitative guides rather than universal reaction rules. Dissolution can have either sign because solvent ordering and solvation contribute; use the full tabulated entropy balance when available. The second law: a spontaneous process increases the entropy of the universe, system plus surroundings. The third law fixes $S = 0$ for a perfect crystal at 0 K, so absolute entropies $S^\circ$ are tabulated and $\Delta S^\circ_r = \sum \nu S^\circ(\text{products}) - \sum \nu S^\circ(\text{reactants})$ (lecture 16, page 3).

## Gibbs free energy

**Model.** For a closed system at fixed temperature and pressure with only pressure–volume work, the surroundings entropy change is $-\Delta H/T$, so the second law for the universe becomes a statement about the system alone:
$$\Delta G = \Delta H - T\Delta S, \qquad \text{spontaneous} \iff \Delta G < 0 .$$
(lecture 16, page 1; OpenStax 16.4). Four cases: $\Delta H < 0$, $\Delta S > 0$ is favourable throughout a range in which the specified phases and assumed signs remain valid; $\Delta H > 0$, $\Delta S < 0$ at none; the mixed cases switch at $T^* = \Delta H/\Delta S$, if $\Delta H$ and $\Delta S$ are taken as independent of temperature. State that assumption whenever you use it.

**Example.** Hydrogen peroxide decomposition, with $S^\circ$ values (J K$^{-1}$ mol$^{-1}$) 109.6 for $\ce{H2O2(l)}$, 70.0 for $\ce{H2O(l)}$ and 205.2 for $\ce{O2(g)}$: $\Delta S^\circ = 2(70.0) + 205.2 - 2(109.6) = +126.0$ J K$^{-1}$ mol$^{-1}$, positive because a gas appears. $\Delta G^\circ(298.15\ \text{K}) = -196.0 - 298.15\times0.1260 = -233.6$ kJ/mol: favourable under the stated standard conditions at 298.15 K. Extrapolating the sign to other temperatures requires checking phases and temperature dependence of enthalpy and entropy. Note the unit conversion of $\Delta S$ from J to kJ; it is the commonest slip in the subject.

**Example.** Ice melting, $\Delta H^\circ = +6.01$ kJ/mol and $\Delta S^\circ = +22.0$ J K$^{-1}$ mol$^{-1}$: $\Delta G^\circ$ changes sign at $T^* = 6010/22.0 = 273$ K, which is 0 °C. Above it, $T\Delta S$ wins and ice melts; below it, it does not. An endothermic process is spontaneous at room temperature; the "exothermic means spontaneous" rule of thumb is false.

**Warning.** $\Delta G^\circ$ is a property of the balanced equation as written: doubling the coefficients doubles $\Delta H^\circ$, $\Delta S^\circ$ and $\Delta G^\circ$. Always quote the equation with its phases alongside the number.

## Chemical equilibrium

A reaction does not run to completion; it reaches a state where forward and reverse rates are equal and the composition stops changing, a **dynamic equilibrium** (lecture 18, page 1; OpenStax 13.1).

**Definition (reaction quotient and equilibrium constant).** For $\ce{aA + bB <=> cC + dD}$,
$$Q = \frac{(a_C)^c (a_D)^d}{(a_A)^a (a_B)^b},$$
where activities are dimensionless. In ideal-gas and dilute-solution approximations, use partial pressure divided by its standard pressure and concentration divided by its standard concentration. Pure solid/liquid activities are one in their specified standard-state approximation; nonideal systems require activity/fugacity corrections. $Q$ can be evaluated for any composition; its value at equilibrium is $K$, a function of temperature only (lecture 18, page 2; OpenStax 13.2). Dividing by the reference states makes $K$ dimensionless. $K_p$ and $K_c$ for a gas reaction are related by $K_p = K_c(RT c^\circ/p^\circ)^{\Delta n}$ for ideal gases when both constants are dimensionless and their concentration/pressure reference states are shown; the units of $R$ must match those references.

**Model.** The free energy of the reaction at an arbitrary composition is
$$\Delta G = \Delta G^\circ + RT\ln Q .$$
At equilibrium $\Delta G = 0$ and $Q = K$, so
$$\Delta G^\circ = -RT\ln K, \qquad K = e^{-\Delta G^\circ/RT},$$
and in general $\Delta G = RT\ln(Q/K)$: if $Q < K$ the forward reaction is spontaneous, if $Q > K$ the reverse is (lecture 18, pages 2 and 4). A large negative $\Delta G^\circ$ means $K \gg 1$ and products dominate at equilibrium; $\Delta G^\circ > 0$ means $K < 1$, not "no reaction". Note which quantity is zero at equilibrium: $\Delta G$, not $\Delta G^\circ$.

**Example (ICE table).** $\ce{PCl5(g) <=> PCl3(g) + Cl2(g)}$ with $K = 0.500$ at a stated temperature (a value given for this example), in a rigid vessel held at that temperature, starting from 1.000 bar of $\ce{PCl5}$ alone. The gases are treated as ideal and the standard pressure is $p^\circ=1$ bar. Constant volume and temperature make each partial pressure proportional to its amount. Initial pressures 1.000, 0, 0; change $-x, +x, +x$; equilibrium $1.000 - x, x, x$. Writing the pressure values numerically in bar, the dimensionless quotient is $(x/p^\circ)^2/((1.000\,\mathrm{bar}-x)/p^\circ)$. Thus $x^2/(1.000 - x) = 0.500$, i.e. $x^2 + 0.500x - 0.500 = 0$, $x = 0.500$ bar. Equilibrium: $P(\ce{PCl5}) = 0.500$ bar, $P(\ce{PCl3}) = P(\ce{Cl2}) = 0.500$ bar. Check: $0.500^2/0.500 = 0.500$. Always substitute back.

## Le Châtelier's principle, explained by Q and K

A system at equilibrium subjected to a stress shifts so as to reduce the stress (lecture 18, page 4). The explanation is always the same (page 5; OpenStax 13.3): the stress changes $Q$, $K$ stays fixed, and the reaction runs in the direction that brings $Q$ back to $K$. Adding a reactant lowers $Q$ below $K$: forward shift. Removing a product does the same. Compressing a gas mixture raises every partial pressure; $Q$ moves away from $K$ in the direction that favours the side with fewer moles of gas. Adding an inert gas at constant volume changes no partial pressure and nothing shifts. A catalyst offers a reversible pathway consistent with the same equilibrium constant at fixed conditions. It does not alter the reaction quotient at a fixed composition; general mechanisms need not be described by equal changes in two barrier heights.

Temperature is different, because it changes $K$ itself. From $\Delta G^\circ = \Delta H^\circ - T\Delta S^\circ = -RT\ln K$,
$$\ln\frac{K_2}{K_1} = -\frac{\Delta H^\circ}{R}\left(\frac{1}{T_2} - \frac{1}{T_1}\right),$$
again assuming $\Delta H^\circ$ constant over the range. Heating raises $K$ for an endothermic reaction and lowers it for an exothermic one, which is the quantitative form of "heat is a reactant or a product" (lecture 19).

## What to carry forward

State the equation with phases, the temperature and the standard state before quoting any $\Delta H^\circ$, $\Delta S^\circ$, $\Delta G^\circ$ or $K$. Spontaneity is $\Delta G$, equilibrium is $\Delta G = 0$, and the constant that summarises it is $K = e^{-\Delta G^\circ/RT}$. Stresses move $Q$; only temperature moves $K$. Next unit: how fast, and the kinetic view of the same equilibrium.
