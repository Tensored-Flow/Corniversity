# Catalysis and kinetics: a mechanism must earn its rate law

A catalyst offers a different reaction pathway. It participates in elementary steps and is regenerated in the net cycle; it need not be inert throughout the process, and it can deactivate in a real system. The purpose of this unit is to connect a proposed pathway to an observable rate law, then recognise which experiment could reject that pathway. MIT lecture 34 develops the enzyme example used as a conceptual source here. The numerical investigations and deductions below are original.

## 1. A faster path has the same endpoints

At fixed temperature and specified standard states, ΔrG° and K belong to the overall chemical reaction. Changing its pathway does not change those state functions. A catalyst can reduce the time required to approach equilibrium, while leaving that equilibrium unchanged. It can change measured product proportions at finite time, or change which pathway competes successfully, without proving that the equilibrium constant changed.

Reaction-coordinate drawings are one-dimensional summaries. Lowering a single shared transition-state energy while keeping endpoints fixed lowers both forward and reverse barrier heights by the same amount in that particular drawing. General catalytic mechanisms can contain multiple intermediates and barriers; it is too strong to insist that every catalyst simply lowers two activation energies by an identical number. The full mechanism must remain consistent with thermodynamic equilibrium.

For the elementary two-state model A ⇌ B, rates are k_f[A] and k_r[B]. Conservation C=[A]+[B] yields d[B]/dt=k_fC−(k_f+k_r)[B]. Its solution is

$$[B](t)=[B]_{eq}+([B]_0-[B]_{eq})e^{-(k_f+k_r)t},\qquad [B]_{eq}=\frac{k_f}{k_f+k_r}C.$$

The ratio k_f/k_r fixes the equilibrium ratio in this ideal model; their sum sets the relaxation timescale. Multiplying both by a factor speeds relaxation without changing its endpoint. Measuring just an endpoint cannot identify the rates.

## 2. Temperature: make the assumptions visible

For a regime modelled by k=A exp(−E_a/RT), with approximately constant A and E_a,

$$\ln(k_2/k_1)=-\frac{E_a}{R}(1/T_2-1/T_1).$$

Temperature is in kelvin and the energy units of E_a must match R. A positive E_a gives increasing k with T within this model. Effective rate constants can behave differently when mechanisms, adsorption, equilibria or protein conformation change. An Arrhenius fit over a narrow interval is not evidence that extrapolation to an arbitrary temperature will work.

Suppose k rises from 0.0200 s⁻¹ at 300 K to 0.0500 s⁻¹ at 320 K. Then E_a=R ln(2.5)/(1/300−1/320)≈36.57 kJ mol⁻¹. The model predicts approximately 0.0321 s⁻¹ at 310 K. A plot of ln(k/k_ref) against 1/T makes the dimensionless logarithm explicit; changing the reference rate shifts the intercept but leaves the slope. Independent replicate rates and uncertainty are needed to assess whether the apparent line is informative.

An equilibrium constant can increase or decrease with temperature. Under a roughly constant reaction enthalpy, d ln K/dT=ΔrH°/(RT²). Thus an exothermic reaction can become faster while its equilibrium becomes less product-favoured. “Heating gives more product” needs a timescale and a thermodynamic context.

## 3. Derive an initial enzyme rate

Consider E+S ⇌ ES → E+P with rate constants k₁, k₋₁ and k₂. Here k₁ has units concentration⁻¹ time⁻¹, while k₋₁ and k₂ have units time⁻¹. We study the initial-rate regime after a short binding transient: little product has accumulated, reverse product reaction is negligible, and free substrate changes slowly relative to ES relaxation. Total enzyme E_T=[E]+[ES] is conserved.

The intermediate balance is

$$\frac{d[ES]}{dt}=k_1[E][S]-(k_{-1}+k_2)[ES].$$

Use the quasi-steady approximation d[ES]/dt≈0, substitute [E]=E_T−[ES], and solve:

$$[ES]\approx\frac{E_T[S]}{K_M+[S]},\quad K_M=\frac{k_{-1}+k_2}{k_1},\quad v=\frac{V_{max}[S]}{K_M+[S]},\quad V_{max}=k_2E_T.$$

This is a kinetic approximation, not an equilibrium assertion that every step has zero net flux. ES can remain nearly constant while product continues to accumulate. A common sufficient separation for the usual initial-rate treatment is E_T much smaller than K_M+[S]_0, together with observation after the fast transient and before major substrate depletion. Always check the actual intended regime rather than memorising that inequality as a universal guarantee.

At [S]≪K_M, v≈(Vmax/K_M)[S]; at [S]≫K_M, v≈Vmax; at [S]=K_M, v=Vmax/2. K_M has concentration units. It equals the binding dissociation constant K_D=k₋₁/k₁ only in an additional rapid-equilibrium limit k₂≪k₋₁. Calling any measured K_M a pure affinity constant can therefore mislead.

## 4. Mechanistic parameters and measurements

With k₁=2.0×10⁶ M⁻¹s⁻¹, k₋₁=30 s⁻¹, k₂=10 s⁻¹ and E_T=0.50 μM, K_M=20 μM and Vmax=5.0 μM s⁻¹. At [S]=40 μM, the predicted initial rate is 3.33 μM s⁻¹. K_D is 15 μM, showing that the two constants differ even in this simple example. Doubling enzyme doubles Vmax in the model but does not change K_M.

These expressions also show an identifiability limit. A noiseless steady initial-rate curve may identify Vmax and K_M, but cannot separately identify all three microscopic rate constants without further measurements. Many positive triples share the same combinations. A good-looking fit does not uniquely establish the mechanism. Measure pre-steady-state transients, binding, or perturbation responses if the microscopic claim matters.

## 5. A competitive inhibitor as an explicit extension

For a simple inhibitor binding free E in rapid equilibrium, assume EI is inactive, inhibitor concentration is effectively fixed and no inhibitor binds ES. The resulting initial rate is v=Vmax[S]/(αK_M+[S]), where α=1+[I]/K_I. Vmax stays the same in the limiting saturating-substrate model, while apparent K_M increases. This is a model prediction; not every inhibitor behaves this way. Reduced activity can instead reflect irreversible enzyme loss, mixed inhibition, altered pH or measurement interference.

Compare curves across substrate concentrations and retain uncertainty. A single reduced rate at one substrate concentration cannot distinguish those alternatives. Measuring only reciprocals and fitting a straight line can overweight low-substrate errors; fitting the original rate equation with a stated noise model is often more interpretable.

## 6. Plan a falsifiable investigation

Choose a prediction that competing explanations disagree on. Report the preparation conditions, temperature, concentration units, blank correction, time window and replicate variation. Check that the “initial” window is approximately linear and does not consume a large fraction of substrate. Fit or calculate using training measurements, reserve additional conditions for prediction, and show residuals. An unexpectedly poor prediction is useful evidence, not a reason to quietly redefine the model. The final problem asks you to distinguish equilibrium yield, reaction speed and catalyst stability in one experiment.
