## Three questions, three kinds of model

Neuromatch opens its course with a classification rather than a formula, and it is worth adopting from the first evening. A **descriptive** ("what") model summarises data: it says what the firing looks like, with a few parameters, and makes no claim about cause. A **mechanistic** ("how") model proposes components and the rules by which they interact, and is tested by whether the components exist and the rules hold. A **normative** ("why") model asks what a system would do if it were optimising something under constraints, and is tested by whether the predicted optimum is observed and whether the constraint is real (W1D1 Tutorials 1–3). The same data can be approached all three ways; the mistake is to confuse the kinds, for example to read a good descriptive fit as an explanation.

A second distinction runs through this course and is a department convention: which data are **recorded** and which are **simulated**. Tutorials 1 and 3 load a subset of the recordings of Steinmetz et al. (2019), mice with Neuropixels probes performing a visual task; the page acknowledges the source and the data have their own terms. Tutorial 2 simulates every spike it shows. Say which is which every time you report a number.

## Spikes, rates and intervals

A neuron's output is a **spike train**, a sequence of times $t_1 < t_2 < \dots$. The **firing rate** over a window of length $T$ containing $n$ spikes is $n/T$; a **raster** plots spike times for many trials or neurons; the **inter-spike intervals** (ISIs) are $\tau_i = t_{i+1} - t_i$. The ISI histogram is the first descriptive model: its shape, mean and spread summarise the firing without saying why.

**Definition (coefficient of variation).** $\text{CV} = \sigma_\tau/\langle\tau\rangle$, the standard deviation of the ISIs divided by their mean. A perfectly regular neuron has CV $= 0$; the random process below has CV $= 1$; many cortical neurons recorded during behaviour lie near 1, and bursting cells exceed it.

**Model (Poisson spiking).** Suppose that in every short interval $dt$ a spike occurs with probability $r\,dt$, independently of everything before. Then the number of spikes in a window of length $T$ is Poisson with mean $rT$, and the ISIs are independent and exponentially distributed with mean $1/r$: exercise 1 derives this and then adds the one biological fact the model ignores, that a neuron cannot fire again immediately after a spike. Tutorial 1 asks you to fit exponential, inverse and linear forms to the Steinmetz ISI histograms by hand; the point of the exercise is less which fits than what fitting can and cannot tell you.

**Example.** A neuron with $r = 10$ s$^{-1}$ under the Poisson model has mean ISI $100$ ms, and the probability that an interval exceeds $200$ ms is $e^{-2} = 0.135$. If the recorded histogram shows almost no intervals below $3$ ms, the pure model is already refuted in detail, and the refined model with a refractory period is the next candidate. A descriptive model is refuted by a feature of the data it cannot produce, not by a single stray point.

## A "how" model: the leaky integrate-and-fire neuron

**Model (LIF).** Treat the membrane as a capacitor leaking through a resistor towards a resting potential $E_L$, driven by an input current $I$:
$$\tau_m\frac{dV}{dt} = -(V - E_L) + RI,$$
with membrane time constant $\tau_m = RC$. When $V$ reaches a threshold $V_{th}$ the model emits a spike, resets $V$ to $V_{reset}$ and holds it there for an absolute refractory period $t_{ref}$ (Tutorial 2; the bonus section gives this full form). The spike itself is not modelled; it is a bookkeeping event.

This is a mechanistic model: it names components (capacitance, leak conductance, threshold) that correspond to measurable things, and it can be wrong in specific ways. For constant input the equation is linear with constant coefficients, so $V$ relaxes exponentially towards $E_L + RI$ with time constant $\tau_m$. Two regimes follow. If $E_L + RI < V_{th}$ the voltage settles below threshold and the neuron never fires: there is a minimum current, the **rheobase**, below which the model is silent. Above it the neuron fires periodically, and exercise 2 derives the period and hence the firing rate as a function of $I$.

**Example (sub-threshold).** With $E_L = -70$ mV, $R = 10$ MΩ, $\tau_m = 10$ ms and $I = 1.0$ nA, the asymptote is $-60$ mV, below a threshold of $-50$ mV; starting from rest the voltage follows $V(t) = -60 - 10e^{-t/10\,\text{ms}}$ mV (the asymptote plus the decaying gap from $-70$ mV), so after $10$ ms it is $-63.7$ mV and it never spikes. Doubling $I$ to $2.0$ nA puts the asymptote exactly at threshold, the boundary case, which exercise 2 identifies as the rheobase.

Tutorial 2 drives the model with Poisson input spikes rather than a constant current and adds inhibition; the output becomes irregular, and the question becomes whether a model with such simple parts can produce the statistics Tutorial 1 measured. What the LIF leaves out is a list worth writing down: the ionic currents that shape the spike, dendrites, adaptation currents that slow firing under sustained input, synaptic dynamics. Each omission is a prediction the model cannot make and therefore an observation that can refute it.

## A "why" model: information and the shape of the ISI distribution

**Definition (entropy).** For a discrete distribution $p$, $H = -\sum_x p(x)\log p(x)$; for a density, the differential entropy $h = -\int p(x)\ln p(x)\,dx$ (Tutorial 3). Entropy measures how unpredictable a sample is, hence how much a message drawn from the distribution can carry.

Tutorial 3 computes the entropy of three toy ISI distributions with the same mean, deterministic, uniform and exponential, and finds the exponential largest; it then computes the entropy of the Steinmetz ISI histograms. The normative hypothesis is this: if a neuron's job were to transmit as much information as possible per spike while firing at a fixed mean rate, its ISIs would be exponential. Exercise 3 asks you to prove the general statement, that among all densities on $[0, \infty)$ with a given mean the exponential maximises differential entropy, and then to say what the theorem does and does not claim about neurons.

**Warning.** A normative model is a hypothesis with two parts: the objective and the constraints. "Neurons maximise information" is not yet a model; "neurons maximise ISI entropy subject to a fixed mean rate and no other constraint" is, and it predicts exponential ISIs. When the data show refractory gaps or bursts, the honest response is to ask which part failed: perhaps the constraint set omitted the refractory period, perhaps the objective is wrong, perhaps the neuron is not optimising anything. The deviation is informative only because the model was stated precisely.

## Reading a model critically

For every model in this course, write four lines in the notebook:

1. **Kind.** Descriptive, mechanistic or normative.
2. **Assumptions.** The independence assumption of the Poisson process; the linear leak and hard threshold of the LIF; the objective and constraint of the entropy argument.
3. **Prediction.** Something quantitative the model says and could be wrong about: CV $= 1$; rheobase; exponential ISIs.
4. **Refuting observation.** A measurement that would count against it: a refractory gap; a firing rate that keeps rising linearly without saturating; a bimodal ISI histogram.

Tutorial 4 is a group discussion in the Neuromatch format. As a solo learner, answer its prompts in writing: which model kinds suit which questions, which you prefer and why, and what would be missing if one kind did not exist. The tutor will take the other side.

## What to carry forward

Three kinds of model, each with assumptions and a refuting observation; the ISI and the CV as the first descriptive statistics; the LIF as a mechanism you can solve by hand; entropy maximisation as a normative claim whose constraints matter. Next unit: fitting models to data properly, with least squares, likelihood, uncertainty and the discipline of held-out data, and the first laboratory on explicitly synthetic spike counts.
