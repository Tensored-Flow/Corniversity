## One framework, three models

Unit 2 fitted a line by least squares and discovered that least squares was maximum likelihood under Gaussian noise. The **generalised linear model** (GLM) makes that discovery a recipe with three ingredients: a linear predictor $z = \mathbf{x}^\top\boldsymbol\theta$ of the inputs; a nonlinearity $g$ that maps $z$ to the parameter of a noise distribution; and the noise distribution itself. Three choices cover most of this course.

**Model (three GLMs).**
- *Linear-Gaussian:* $g$ is the identity, noise Gaussian; $y \sim \mathcal{N}(\mathbf{x}^\top\boldsymbol\theta, \sigma^2)$. Ordinary regression.
- *Poisson:* $g = \exp$, noise Poisson; $y \sim \text{Poisson}(\exp(\mathbf{x}^\top\boldsymbol\theta))$. For spike counts; the tutorial calls it the linear–nonlinear–Poisson (LNP) model.
- *Logistic (Bernoulli):* $g = \sigma$, the logistic function $\sigma(z) = 1/(1 + e^{-z})$, noise Bernoulli; $P(y = 1 \mid \mathbf{x}) = \sigma(\mathbf{x}^\top\boldsymbol\theta)$. For binary outcomes such as a choice.

In each case the parameters are fitted by maximising the log-likelihood, and in each case (for these canonical nonlinearities) the log-likelihood is concave, so a local maximum is the global one. W1D3 uses the first two for **encoding**, predicting a neuron's response from the stimulus, and the third for **decoding**, predicting behaviour from neural responses.

Both tutorials in this unit use recorded data for the first time in the course. Tutorial 1 loads responses of a retinal ganglion cell to a flickering screen, from Uzzell and Chichilnisky (2004), which the page says are "provided for tutorial purposes only"; Tutorial 2 loads a subset of the Steinmetz et al. (2019) recordings, spike counts from 691 neurons on 276 trials together with the animal's choice. Treat both as real observations with their own terms: link to them, do not redistribute them, and keep your statements about them separate from anything fitted to synthetic data.

## Encoding: the temporal receptive field

A sensory neuron responds not to the stimulus now but to its recent history. Stack the last $d$ stimulus values before each time bin $t$ into a row $\mathbf{x}_t$ of a **design matrix** $\mathbf{X}$ ($T \times d$, plus a column of ones for an intercept); the weight vector $\boldsymbol\theta$ is then a **temporal filter**, or receptive field, saying how each lag contributes (Tutorial 1, Section 1.1).

The Linear-Gaussian fit is the normal equations of unit 2 applied to spike counts. It gives a reasonable filter shape and an unreasonable model: predicted rates can go negative, and counts are not Gaussian with constant variance. The Poisson GLM repairs both. Its rate is $\lambda_t = \exp(\mathbf{x}_t^\top\boldsymbol\theta)$, always positive, and its log-likelihood, dropping the $\theta$-independent $\ln y_t!$ terms, is
$$\ell(\boldsymbol\theta) = \sum_t\big[y_t\,\mathbf{x}_t^\top\boldsymbol\theta - \exp(\mathbf{x}_t^\top\boldsymbol\theta)\big] = \mathbf{y}^\top\ln\boldsymbol\lambda - \mathbf{1}^\top\boldsymbol\lambda,$$
as the tutorial writes it. There is no closed form; the tutorial maximises it numerically with `scipy.optimize`. Exercise 1 derives the gradient and Hessian, proves concavity and reads off what the fitted weights mean.

**Example.** Because the nonlinearity is exponential, the filter acts multiplicatively: if $\theta_k = 0.3$, a unit increase in the stimulus at lag $k$ multiplies the predicted rate by $e^{0.3} = 1.35$, whatever the other inputs are doing. A negative weight at a lag means that stimulus value at that lag suppresses firing. The intercept sets the rate when all inputs are zero.

What the filter is evidence of: a statistical dependence of this cell's firing on stimulus history in this recording, under the assumptions that the dependence is linear in the exponent, that counts in different bins are conditionally independent given the stimulus, and that the cell is stationary across the recording. What it is not: a mechanism, a claim about other cells, or an account of the cell's own refractory and bursting dynamics, which the independence assumption ignores (adding the cell's own spike history as inputs is the standard extension).

## Decoding: logistic regression

Turn the problem round. On each trial of the Steinmetz task the mouse makes a choice; can the population activity predict it? Logistic regression models the log-odds as linear in the neural features, $\ln\frac{p}{1 - p} = \mathbf{x}^\top\boldsymbol\theta$, and fits $\boldsymbol\theta$ by maximum likelihood; the negative log-likelihood is the **cross-entropy** (Tutorial 2, Section 1). Exercise 2 derives it and its gradient.

**Example.** At $\mathbf{x}^\top\boldsymbol\theta = 0$ the predicted probability is $0.5$; at $2$ it is $\sigma(2) = 0.88$; at $-2$ it is $0.12$. The decision boundary $\mathbf{x}^\top\boldsymbol\theta = 0$ is a hyperplane in the 691-dimensional space of neural features.

**Definition (evaluation against chance).** Accuracy is the fraction of held-out trials classified correctly. Its meaning depends on the baseline: for a balanced binary task the majority-class baseline is $50\%$; for an imbalanced task it is the larger class fraction, which can make a useless decoder look good. Two controls are standard: compare with the majority baseline, and refit on shuffled labels to see the distribution of accuracies a decoder achieves by chance on this data (Tutorial 2, Section 2). Accuracy must come from trials the fit never saw, with every data-dependent choice, including which neurons to include and how strong the penalty is, made inside the cross-validation loop. Selecting features on all trials and then cross-validating is **leakage**, and it inflates accuracy in exactly the way that is hardest to notice.

## Regularisation

With 691 features and 276 trials, unpenalised logistic regression can separate the training data perfectly and generalise badly. **Regularisation** adds a penalty to the negative log-likelihood (Tutorial 2, Section 3):
$$-\ell'(\boldsymbol\theta) = -\ell(\boldsymbol\theta) + \frac{\beta}{2}\sum_i\theta_i^2 \quad\text{(L2, ridge)}, \qquad -\ell'(\boldsymbol\theta) = -\ell(\boldsymbol\theta) + \frac{\beta}{2}\sum_i|\theta_i| \quad\text{(L1, lasso)}.$$
L2 shrinks all weights towards zero; L1 drives many to exactly zero, giving a **sparse** decoder that uses few neurons. Both are maximum a posteriori estimation under a prior, Gaussian for L2 and Laplace for L1, so the fitted weights now reflect the prior as well as the data. The strength $\beta$ is a hyperparameter, chosen by cross-validation; the tutorial has you sweep it and watch training and validation accuracy separate.

**Warning.** A sparse decoder that reads the choice from fifteen neurons does not show that those fifteen neurons carry the choice and the others do not. With correlated features L1 picks one of a correlated group almost arbitrarily. Sparsity is a property of the estimator under the prior, not a discovery about the circuit.

## Encoding, decoding and causation

Encoding models predict responses from stimuli; decoding models predict variables from responses. Both are statistical statements about dependence in a recording. Neither is causal: a decoder that predicts the choice from a population may be reading a cause of the choice, a consequence of it, or a copy relayed from elsewhere, and no amount of accuracy distinguishes these. Distinguishing them needs intervention, the topic of W3D5. The honest sentence is "choice can be decoded from this population with accuracy $a$ against a baseline of $b$ on held-out trials", and nothing stronger.

## What to carry forward

A GLM is a linear predictor, a nonlinearity and a noise model; pick the noise model for the data, not for convenience. Poisson GLMs give positive rates and multiplicative filters; logistic regression gives decoders whose accuracy means nothing without a baseline, a shuffle control and a leak-free split. Regularisation is a prior and changes the meaning of the weights. Decoding is not causation. Next unit: reducing the dimensionality of population activity with PCA, and what variance explained does and does not mean.
