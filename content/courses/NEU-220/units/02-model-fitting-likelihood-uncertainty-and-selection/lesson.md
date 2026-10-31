## Fitting as estimation

Unit 1 asked what a model assumes. This unit asks how to set its parameters from data and how much to believe the result. Neuromatch W1D2 does this on simulated data with a known truth, and that choice is pedagogical, not incidental: only when the true parameter is known can you check whether an estimator and its uncertainty behave as claimed. Every dataset in this unit's tutorials is synthetic and says so; the laboratory at the end is synthetic too, and labelled on every screen.

## Least squares

**Model.** The simplest regression is $y_i = \theta x_i + \epsilon_i$ for $i = 1, \dots, N$, with $\epsilon_i$ a noise term. The **mean squared error** of a candidate slope is
$$\text{MSE}(\theta) = \frac{1}{N}\sum_{i=1}^N (y_i - \theta x_i)^2 .$$
Minimising it gives the least-squares estimate; Tutorial 1 has you compute MSE on a grid and then solve for the optimum, which has the closed form $\hat\theta = \mathbf{x}^\top\mathbf{y}/\mathbf{x}^\top\mathbf{x}$. Exercise 1 derives it by differentiation.

**Example.** For synthetic points $(1, 2.0)$, $(2, 4.1)$, $(3, 5.9)$, $(4, 8.2)$: $\sum x_iy_i = 2.0 + 8.2 + 17.7 + 32.8 = 60.7$ and $\sum x_i^2 = 30$, so $\hat\theta = 60.7/30 = 2.023$. The generating slope was $2$; the estimate is off by about one percent, which is the noise, not an error.

**Definition (design matrix).** With several inputs, or with polynomial features $1, x, x^2, \dots, x^k$, stack them as the columns of a matrix $\mathbf{X}$ ($N \times p$) so that the model is $\mathbf{y} = \mathbf{X}\boldsymbol\theta + \boldsymbol\epsilon$. The least-squares solution is the **normal equations** $\hat{\boldsymbol\theta} = (\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{X}^\top\mathbf{y}$ (Tutorial 4), which requires $\mathbf{X}^\top\mathbf{X}$ to be invertible, i.e. no column a linear combination of others. Polynomial regression is linear regression with a particular design matrix; the model is nonlinear in $x$ and linear in the parameters, and that second linearity is what makes the closed form possible.

## Maximum likelihood

Least squares says nothing about noise. Maximum likelihood starts from a probability model for it.

**Definition (likelihood).** If $y_i \sim \mathcal{N}(\theta x_i, \sigma^2)$ independently, the probability density of the observed data as a function of the parameter is the likelihood $L(\theta) = \prod_i p(y_i \mid x_i, \theta)$; the **maximum-likelihood estimate** maximises it, or equivalently its logarithm (Tutorial 2). For Gaussian noise of constant variance the log-likelihood is $-\frac{1}{2\sigma^2}\sum(y_i - \theta x_i)^2$ plus terms not involving $\theta$, so maximising it is minimising the sum of squares: the MLE equals the least-squares estimate. Exercise 1 asks you to show this and then to change the assumption: if each point has its own known noise level $\sigma_i$, the MLE becomes **weighted least squares**, with precise points counting more. Least squares is therefore not neutral; it is maximum likelihood under one noise model, and when that model is wrong (unequal variances, outliers, counts), the estimator changes.

## How uncertain is the estimate?

**Model (bootstrap).** Given one dataset of $N$ pairs, draw $N$ pairs from it with replacement, refit, and repeat many times; the spread of the refitted estimates approximates the sampling variability of the estimator, and the 2.5th and 97.5th percentiles give a 95% **percentile confidence interval** (Tutorial 3). It assumes the pairs are independent and the sample is representative of the population; it fails when either is false, for example with strong serial dependence, or when a single high-leverage point dominates the fit. In the tutorial the true slope is $1.2$ and you can see whether the interval covers it; this is the check that real data never allow.

**Warning.** A 95% interval does not say the true value lies in it with probability 95%. It says that intervals constructed this way cover the true value in about 95% of repeated samples, if the assumptions hold. The distinction matters when you report a fitted tuning curve.

## How complex a model?

With a polynomial design matrix you can fit the training data as closely as you like by raising the order. Tutorial 5 splits synthetic data into training and test sets and shows the familiar picture: training error falls with order; test error falls, then rises. The explanation is the **bias–variance decomposition**: at a fixed input $x$, with $y = f(x) + \epsilon$ and $\hat f$ fitted on an independent training set,
$$\mathbb{E}\big[(y - \hat f(x))^2\big] = \sigma^2 + \big(f(x) - \mathbb{E}\hat f(x)\big)^2 + \text{Var}\big(\hat f(x)\big),$$
irreducible noise plus squared bias plus variance. Simple models are biased; flexible models are variable. Exercise 2 proves it. **Cross-validation** (Tutorial 6) makes the test more efficient: split the data into $k$ folds, fit on $k - 1$ and test on the held-out fold, rotate, and average; the bonus introduces the AIC as a likelihood-based alternative. The rule for this course is that any comparison between models is made on data the fit did not see.

## Tuning curves and Poisson counts

A **tuning curve** gives the mean firing rate of a neuron as a function of a stimulus variable, for example the orientation of a grating. A common parametric form for a periodic variable is the von Mises curve,
$$\lambda(\theta) = b + A\exp\big(\kappa\cos(2(\theta - \theta_{\text{pref}}))\big),$$
with baseline $b$, amplitude $A$, concentration $\kappa$ (narrower tuning for larger $\kappa$) and preferred orientation $\theta_{\text{pref}}$; the factor $2$ gives a period of $180^\circ$. Spike counts $n$ in a window of length $T$ are integers, nonnegative and typically with variance near their mean, so the natural noise model is Poisson, $n \sim \text{Poisson}(\lambda(\theta)T)$, rather than Gaussian. The log-likelihood of counts $n_i$ at orientations $\theta_i$ is
$$\ell = \sum_i\big[n_i\ln(\lambda(\theta_i)T) - \lambda(\theta_i)T - \ln n_i!\big],$$
and it is maximised numerically. The simplest competing model is a **constant-rate baseline**, $\lambda(\theta) = b$: a neuron with no tuning at all. A tuning model earns its parameters only if it beats the baseline on held-out trials.

**Model (the laboratory).** The application's `neural-tuning-fit` laboratory generates synthetic counts from a known von Mises neuron with Poisson noise, splits trials into training and held-out sets, and lets you fit both models and bootstrap the parameters. It then offers a second synthetic neuron built to break the model, for example one with two preferred orientations or with counts more variable than Poisson. The report, exercise 3, is the unit's main assessed work. Its rules are the department's: the data are synthetic and called synthetic in every sentence that mentions them; the model is compared with a baseline out of sample; the parameters are interpreted with their uncertainty; the failure case is diagnosed; and nothing is claimed about biological neurons.

## What to carry forward

Least squares is maximum likelihood under Gaussian noise; change the noise model and the estimator changes. Uncertainty comes from resampling or from the likelihood, with assumptions attached. Complexity is chosen on held-out data, never on training error. Counts are Poisson, and a model must beat the baseline out of sample before its parameters mean anything. Next unit: the same likelihood machinery as generalised linear models for encoding and decoding, on recorded data for the first time.
