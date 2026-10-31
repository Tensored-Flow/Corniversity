## How fast?

Thermodynamics told us which way a reaction goes and how far. It said nothing about time: glucose and oxygen are far from equilibrium in a sugar bowl and stay there for years. Kinetics measures and models rates, and it ends by meeting equilibrium from the other side (lecture 30, page 1).

**Definition (rate of reaction).** For $\ce{aA + bB -> cC + dD}$,
$$\text{rate} = -\frac{1}{a}\frac{d[\ce{A}]}{dt} = -\frac{1}{b}\frac{d[\ce{B}]}{dt} = \frac{1}{c}\frac{d[\ce{C}]}{dt} = \frac{1}{d}\frac{d[\ce{D}]}{dt},$$
in M s$^{-1}$ (lecture 30, page 3; OpenStax 12.1). The coefficients make the rate independent of which species is monitored. An average rate is $\Delta[\ce{X}]/\Delta t$ over an interval; the instantaneous rate is the slope of the concentration–time curve. Always say which species and which definition you are using.

**Example.** For $\ce{2 N2O5(g) -> 4 NO2(g) + O2(g)}$, $\ce{NO2}$ appears four times as fast as $\ce{O2}$ and twice as fast as $\ce{N2O5}$ disappears: $\text{rate} = -\tfrac12 d[\ce{N2O5}]/dt = \tfrac14 d[\ce{NO2}]/dt = d[\ce{O2}]/dt$.

## Rate laws come from experiment

**Definition (rate law).** $\text{rate} = k[\ce{A}]^m[\ce{B}]^n\cdots$, where $k$ is the rate constant and $m$, $n$ are the orders with respect to each species; their sum is the overall order (OpenStax 12.3). The orders are experimental facts. They cannot be read from the balanced equation unless the reaction is a single elementary step; they may be fractional, zero or negative, and products may appear (lecture 30, pages 3–4).

**Example (method of initial rates).** Suppose doubling $[\ce{A}]$ at fixed $[\ce{B}]$ doubles the initial rate, and doubling $[\ce{B}]$ at fixed $[\ce{A}]$ quadruples it. Then $2^m = 2$ gives $m = 1$ and $2^n = 4$ gives $n = 2$: $\text{rate} = k[\ce{A}][\ce{B}]^2$, third order overall. The units of $k$ follow from the rate law: here M s$^{-1}$ divided by M$^3$, so $k$ is in M$^{-2}$ s$^{-1}$. For a first-order law $k$ is in s$^{-1}$; for second order, M$^{-1}$ s$^{-1}$.

## Integrated rate laws

Initial rates are hard to measure precisely. The alternative is to integrate the rate law and fit concentration against time (lecture 30, pages 4–5; OpenStax 12.4).

**Model.** First order, $-d[\ce{A}]/dt = k[\ce{A}]$: separating variables, $\ln[\ce{A}]_t = \ln[\ce{A}]_0 - kt$, so $[\ce{A}]_t = [\ce{A}]_0e^{-kt}$. A plot of $\ln[\ce{A}]$ against $t$ is a straight line of slope $-k$. The half-life $t_{1/2} = \ln 2/k = 0.693/k$ is independent of concentration: the same time halves a tonne or a gram (lecture 30, page 6). Second order, $-d[\ce{A}]/dt = k[\ce{A}]^2$: $1/[\ce{A}]_t = 1/[\ce{A}]_0 + kt$, linear in $1/[\ce{A}]$, with $t_{1/2} = 1/(k[\ce{A}]_0)$, which lengthens as the reactant is used up (lecture 31, page 3). Zero order: $[\ce{A}]_t = [\ce{A}]_0 - kt$. To find the order from data, make all three plots and see which is straight.

**Example.** A first-order decomposition with $k = 0.0150$ s$^{-1}$ has $t_{1/2} = 0.693/0.0150 = 46.2$ s; after 100 s the fraction remaining is $e^{-1.50} = 0.223$. Radioactive decay obeys the same mathematics with the number of nuclei in place of concentration (lecture 31, page 1).

## Mechanisms: proposing and testing

**Definition (elementary step, molecularity).** A mechanism is a sequence of elementary steps, each occurring exactly as written. For an elementary step, and only then, the rate law follows from the stoichiometry: a unimolecular step $\ce{A -> P}$ has rate $k[\ce{A}]$, a bimolecular step $\ce{A + B -> P}$ has rate $k[\ce{A}][\ce{B}]$; termolecular steps are rare (lecture 31, page 4; OpenStax 12.6). The steps must add to the overall equation, and species that appear and are consumed are intermediates, which must not appear in the final rate law.

**Model (testing a mechanism).** Derive the rate law the mechanism predicts and compare it with the experimental one. Agreement does not prove the mechanism; disagreement refutes it. Two approximations do the work (lecture 32, pages 1–3).

The notes' Example 1 is $\ce{2 NO + O2 -> 2 NO2}$ with the observed rate $k_{\text{obs}}[\ce{NO}]^2[\ce{O2}]$. Proposed: step 1, $\ce{NO + NO <=> N2O2}$ ($k_1$, $k_{-1}$); step 2, $\ce{N2O2 + O2 -> 2 NO2}$ ($k_2$). The rate of formation of $\ce{NO2}$ is $2k_2[\ce{N2O2}][\ce{O2}]$, the factor 2 because each step-2 event makes two molecules; this contains the intermediate. **Steady state**: set the net rate of formation of $\ce{N2O2}$ to zero, $k_1[\ce{NO}]^2 - k_{-1}[\ce{N2O2}] - k_2[\ce{N2O2}][\ce{O2}] = 0$, giving $[\ce{N2O2}] = k_1[\ce{NO}]^2/(k_{-1} + k_2[\ce{O2}])$ and a rate law that is not of the observed form in general. **Pre-equilibrium**: if step 1 is fast and reversible and step 2 is slow, the **rate-determining step**, then $k_{-1} \gg k_2[\ce{O2}]$ and $[\ce{N2O2}] = (k_1/k_{-1})[\ce{NO}]^2 = K_1[\ce{NO}]^2$, so the rate of $\ce{NO2}$ formation is $2k_2K_1[\ce{NO}]^2[\ce{O2}]$, matching experiment with $k_{\text{obs}} = 2k_2K_1$. The slow-first-step alternative would give a rate law first order in $\ce{NO}$, which is refuted. Deciding which limit holds is itself an experiment: change the concentration that appears in the denominator and watch the apparent order change.

## Rate constants and the equilibrium constant

At equilibrium the forward and reverse rates are equal. For an elementary step $\ce{A + B <=> C + D}$ with forward rate $k_1[\ce{A}][\ce{B}]$ and reverse rate $k_{-1}[\ce{C}][\ce{D}]$,
$$k_1[\ce{A}][\ce{B}] = k_{-1}[\ce{C}][\ce{D}] \quad\Longrightarrow\quad K = \frac{[\ce{C}][\ce{D}]}{[\ce{A}][\ce{B}]} = \frac{k_1}{k_{-1}}$$
(lecture 31, page 4). $K > 1$ means the forward rate constant exceeds the reverse one. This is the kinetic face of the thermodynamic $K$ of unit 4; for a multi-step mechanism $K$ is the product of the ratios for the steps.

## Temperature and catalysts

**Model (Arrhenius).** $k = Ae^{-E_a/RT}$, so $\ln k = \ln A - E_a/RT$: a plot of $\ln k$ against $1/T$ is a straight line of slope $-E_a/R$ (lecture 33, page 1; OpenStax 12.5). $E_a$ is the activation energy, the minimum collision energy that leads to reaction; $A$ collects collision frequency and orientation. Between two temperatures,
$$\ln\frac{k_2}{k_1} = -\frac{E_a}{R}\left(\frac{1}{T_2} - \frac{1}{T_1}\right),$$
the same form as the van 't Hoff equation for $K$, with $E_a$ in place of $\Delta H^\circ$ (lecture 33, pages 2 and 6). Rate constants always increase with temperature because $E_a > 0$ for an elementary step; equilibrium constants increase or decrease according to the sign of $\Delta H^\circ$. On a reaction coordinate diagram the forward and reverse barriers differ by the energy change of the reaction, $\Delta E = E_{a,f} - E_{a,r}$ (page 4). A catalyst provides a path with a lower barrier for both directions: both rate constants rise, their ratio $K$ does not change, and the equilibrium composition is the same, reached sooner (OpenStax 12.7).

**Warning.** A large $E_a$ means a rate constant very sensitive to temperature; a large $|\Delta H^\circ|$ means an equilibrium constant very sensitive to temperature. The notes' $\ce{2 NO + O2}$ example shows that an overall rate can even fall on heating when a fast pre-equilibrium with large negative $\Delta H^\circ$ feeds a slow step (page 5). Always ask which constant you are talking about.

## The reversible reaction as a model

**Model.** The laboratory of this unit is a virtual model, not an experiment: a well-mixed system at constant volume and temperature in which $\ce{A}$ converts to $\ce{B}$ and back, each step elementary and first order,
$$\frac{d[\ce{A}]}{dt} = -k_f[\ce{A}] + k_r[\ce{B}], \qquad \frac{d[\ce{B}]}{dt} = k_f[\ce{A}] - k_r[\ce{B}], \qquad k_f, k_r \ge 0 .$$
Everything about this system follows from the two equations, and exercise 3 asks you to work it out: what is conserved, how the concentrations approach their limits, what the limits are, how they depend on the rate constants, and which observations would tell this system apart from a mixture in which nothing is happening at all. Before you touch the simulator, write down what you expect; then run it and compare. When the model and your derivation disagree, one of them is wrong, and finding out which is the activity.

**Warning.** The simulator shows the model's outputs, not measurements of a real reaction. Claims about actual chemistry need the assumptions checked: real reactions have more than two species, rate constants that depend on temperature, and solutions that are not ideal. Say what you assumed.

## What to carry forward

Rate laws are measured, then explained by mechanisms that can be refuted. Integrated rate laws turn concentration–time data into orders and rate constants. Equilibrium is the state of equal forward and reverse rates, so $K = k_f/k_r$ for elementary steps, which connects this unit to the last. Temperature moves rate constants and equilibrium constants by the same mathematics and for different reasons. Next: acid–base equilibria, where the equilibrium machinery of unit 4 meets water.
