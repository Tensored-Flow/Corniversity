# Acid–base equilibria: choosing the equation before solving it

An acid–base calculation is a small model of a solution. The hard step is usually deciding which species remain after mixing and which approximation is legitimate. A memorised pH formula cannot make that decision for you.

**Primary reading.** Read MIT 5.111SC lectures 21–24 through the Unit III link: lecture 21, notes pages 1–5, develops water, conjugate pairs and weak-acid equilibria; lecture 22, pages 2–5, develops buffers; lecture 23, pages 1–6, and lecture 24, pages 1–3, distinguish the regions of a titration. The notes have deliberate fill-in blanks. These original notes supply a complete argument to accompany that reading. The OpenStax links are optional human reading, not material supplied to the AI tutor.

## The quantities that actually enter equilibrium

A Brønsted acid donates a proton; its conjugate base differs by one proton. For a monoprotic acid write

$$\ce{HA + H2O <=> H3O+ + A-}.$$

Thermodynamic equilibrium constants use **dimensionless activities**. In a dilute ideal solution we approximate the activity of a solute by its concentration divided by the standard concentration $c^\circ=1\,\mathrm{mol\,L^{-1}}$, and that of water by one. Below, concentration-form expressions use numerical concentrations in molarity; the ideality and temperature assumptions are part of every answer.

Writing $h=[\ce{H3O+}]$ and $o=[\ce{OH-}]$, water gives $ho=K_w$ in this concentration convention. At $25^\circ\mathrm C$, $K_w\approx10^{-14}$ and $\mathrm{pH}=-\log_{10}(h/c^\circ)$. Hence $\mathrm{pH}+\mathrm{pOH}=\mathrm pK_w$. Neutrality means $h=o$, not universally pH 7: the numerical neutral pH changes with temperature.

For a conjugate pair, $K_aK_b=K_w$. Derive this by multiplying the acid and base reaction quotients and cancelling the conjugate species. Stronger acid therefore means weaker conjugate base. Strength is an equilibrium property; concentration is how much material was introduced. A dilute strong acid and a concentrated weak acid need not have pH values in the order their names suggest.

## Worked example: a weak acid, with the approximation checked

Suppose an ideal monoprotic acid has analytical concentration $C=0.100\,\mathrm M$ and $K_a=1.00\times10^{-5}$ at $25^\circ\mathrm C$. Neglect water ionisation provisionally. Conservation gives $[\ce{HA}]+[\ce{A-}]=C$; electrical neutrality then gives $[\ce{A-}]\approx h$. Thus

$$K_a=\frac{h^2}{C-h},\qquad h^2+K_ah-K_aC=0.$$

Only the positive root is physical. A numerically stable form is

$$h=\frac{2K_aC}{K_a+\sqrt{K_a^2+4K_aC}}=9.95\times10^{-4}\,\mathrm M.$$

The estimate $h\approx\sqrt{K_aC}=1.00\times10^{-3}\,\mathrm M$ differs by about half a percent, because $h/C\approx0.010$. Also $h\gg10^{-7}\,\mathrm M$, so neglecting water is consistent. The pH is approximately 3.002. State both checks; solving a quadratic does not repair a wrong chemical model.

If the approximation fails, retain $C-h$. If water is no longer negligible, use **both** mass balance and charge balance. For this pure acid solution,

$$[\ce{A-}]=\frac{CK_a}{K_a+h},\qquad h=\frac{CK_a}{K_a+h}+\frac{K_w}{h}.$$

This scalar equation is more reliable than trying to patch a square-root formula. It has a physical positive solution; a numerical root must still satisfy the balances. With a polyprotic acid, introduce each successive dissociation and a total mass balance. Treat dissociations separately only when the constants are sufficiently separated for the desired accuracy. A salt can acidify or basify water because its ions can be conjugates of weak bases or weak acids; “salt” does not mean “neutral”.

## Buffers: a ratio sets pH, an amount sets capacity

Rearranging the acid equilibrium gives

$$\mathrm{pH}=\mathrm pK_a+\log_{10}\frac{a_{\ce{A-}}}{a_{\ce{HA}}}.$$

This activity relation follows directly from equilibrium. Replacing the equilibrium ratio by the ratio of **amounts added after neutralisation** is the approximation in the familiar Henderson–Hasselbalch calculation. It is useful when both forms remain in appreciable amounts and their further ionisation changes are small.

**Worked example.** In a final volume of $1.00\,\mathrm L$, take $0.0400$ mol HA and $0.0800$ mol A$^-$ with $\mathrm pK_a=5.00$. Initially pH is approximately $5.00+\log_{10}2=5.301$. If a hypothetical $0.0100$ mol increment of strong acid is included, it consumes A$^-$ stoichiometrically, leaving $0.0500$ mol HA and $0.0700$ mol A$^-$. The new pH is approximately $5.00+\log_{10}(0.0700/0.0500)=5.146$. The buffer resisted the change; it did not eliminate it.

The same ratio at one hundredth the total concentration has similar initial pH only while the equilibrium approximation holds, but far less capacity. Once either component is exhausted, stop using the buffer ratio. Account for excess strong acid or base and re-establish the remaining equilibria. Dilution can preserve a ratio while destroying the approximation and the practical capacity.

## Titration is a sequence of different limiting models

A titration curve is the predicted pH as a known amount of acid or base is added. Here it is a paper calculation, not a laboratory procedure. For weak HA with a strong monobasic base, distinguish:

1. **Before addition:** solve the weak-acid equilibrium.
2. **Before equivalence:** consume added hydroxide first; then solve the HA/A$^-$ buffer equilibrium using the new total volume.
3. **At equivalence:** almost all analytical acid is present as its conjugate base. Solve hydrolysis with $K_b=K_w/K_a$; pH is generally above the neutral value.
4. **Beyond equivalence:** the excess strong base generally controls pH, with equilibrium corrections checked when the excess is tiny.

At half-equivalence, pH is approximately $\mathrm pK_a$ when the buffer approximation is valid. At equivalence, the **stoichiometric** quantities match; this says nothing by itself about the acidity of the resulting salt. An indicator's endpoint is an observation with a transition range, not the mathematical equivalence condition.

As a worked scale check, $20.0\,\mathrm{mL}$ of $0.100\,\mathrm M$ HA with $K_a=10^{-5}$ reaches equivalence after $20.0\,\mathrm{mL}$ of $0.100\,\mathrm M$ base. The conjugate base concentration is then $0.0500\,\mathrm M$. With $K_b=10^{-9}$, $[\ce{OH-}]\approx\sqrt{K_bC}=7.07\times10^{-6}\,\mathrm M$ and pH $\approx8.85$. Omitting dilution would give a different answer even though the neutralisation equation was correct.

## A method to carry forward

Start every problem with species, stoichiometric inventory, mass balance, charge balance and equilibrium relations. Simplify only after identifying a small parameter. Check the approximation, signs, concentration units and sensible limits. On a later day, reconstruct the four titration regimes without the notes, and explain why each replacement model is valid. The goal is to recognise when a convenient formula stops describing the solution.
