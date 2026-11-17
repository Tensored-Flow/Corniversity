# Generalisation and early stopping: what does the measured error estimate?

A learner can fit the observations it has seen and fail on the observations that matter next. To investigate that gap, first define the target of prediction and the sampling process. A split into three arrays is useful only if the arrays reflect the independence, time ordering and population conditions needed by the intended claim. Read Neuromatch W2D1 Tutorial 1 on overfitting, validation, memorisation and early stopping; these notes turn those ideas into explicit estimation and selection problems.

## 1. Empirical risk is an observation, population risk is a target

For a fixed model f and data distribution P, population risk is R(f)=E_P[ℓ(f (X), Y)]. A test average estimates it only under suitable sampling assumptions and provided the model-selection procedure did not adapt to those test outcomes. Training risk is deliberately minimised using the training sample, so it is generally optimistic as an estimate of performance on fresh observations. A training–test gap is one diagnostic, not a complete description of model quality.

A model can have low training error and low population error; memorisation capacity alone does not prove poor generalisation. Conversely a small model can fail because its assumptions are wrong. Useful questions include whether performance holds across independent examples, groups, time periods and relevant shifted conditions. An interpolating model might generalise on one distribution and fail on another. Avoid a universal claim that increasing parameter count must always hurt test performance.

## 2. Bias and variance describe repeated datasets

For squared-error regression suppose Y=f*(x)+ε with E[ε|x]=0 and Var(ε|x)=σ²(x). Treat the fitted prediction f_D(x) as random because the training dataset D changes, and assume the fresh test noise is independent of D. Add and subtract μ(x)=E_D[f_D(x)] and expand. Cross terms vanish, giving

$$E_{D,\epsilon}[(f_D(x)-Y)^2]=(\mu (x)-f^*(x))^2+\operatorname{Var}_D(f_D(x))+\sigma^2(x).$$

The three terms are squared bias, estimator variance and irreducible noise under the model. This is an expectation over repeated training samples, not a rule that decomposes one observed training curve. Different random initialisations with one fixed dataset measure a different component of variation from repeated data sampling. A low-variance but biased predictor can be consistently wrong.

For example, if true conditional mean is 2, a procedure's prediction mean is 1.5, prediction variance is.36 and independent noise variance is.25, expected squared prediction error is.25+.36+.25=.86. Reducing one component may increase another; validation measures the resulting predictive trade-off, with its own noise.

## 3. The split unit should match the claim

If multiple rows describe the same person, device, household or source document, random row splitting can put near-duplicates or shared information in train and test. Split by the entity relevant to the intended new-entity claim. For forecasting, train must not include future information unavailable at prediction time, including retrospectively constructed features. Fit preprocessing, feature selection and imputation on training data, then apply frozen transformations to validation and test.

Labels need special care: a feature calculated after the outcome can leak the answer even when the files are split correctly. A synthetic demonstration with known data generation is useful for debugging, but must be labelled synthetic and cannot support a real-world efficacy claim. Distribution shift can remain even after a technically clean split. Document what fresh cases the test sample actually represents.

Validation is for selecting hyperparameters, features, architectures, thresholds and stopping times. Repeatedly choosing the best of many noisy validation measurements can overfit validation too. Nested validation, a larger independent evaluation sample, or a new preregistered confirmation can help when the search is extensive. There is no magic filename that keeps a repeatedly inspected test set untouched.

## 4. Early stopping is model selection along a trajectory

A training run produces a sequence f₀, f₁,… . Choosing a checkpoint by validation loss selects among those models. Specify the metric, direction, minimum improvement, patience, maximum budget and tie-breaking rule before interpreting the result. Save a deep copy of the best state, because a mutable reference may silently continue changing during training. At the end, restore the selected state rather than automatically using the last state visited.

Patience is a practical response to noisy validation traces, not a proof of generalisation. Training loss need not rise when overfitting begins; it can keep falling while validation gets worse. A transient increase in validation loss need not mean all later checkpoints are worse. The stopping rule trades computation against missed later improvement; report it as part of the procedure.

For linear least squares with whitened eigen-coordinates, each GD component behaves like a shrinkage filter. If curvature is λ>0 and the optimum coordinate is w*, starting from 0 gives w_t=[1−(1−ηλ)^t]w*. Early iterations suppress slowly learned directions more. This resembles regularisation, but it is not identical to one common ridge parameter for every eigenvalue: ridge shrinkage is λ/(λ+α), whereas the early-stopping factor has a different functional form. The comparison also depends on a stable step and the linear-quadratic model.

## 5. A transparent checkpoint experiment

This original deterministic program deliberately gives training observations a different slope from validation observations. It shows the mechanics of selection, not a sampled generalisation result. There is no random seed. Training and validation arrays are separate, and the two test inputs are inspected only after the fixed checkpoint rule selects a model.

```python
train = [(-1.0, -3.0), (1.0, 3.0)]
valid = [(-1.0, -2.0), (1.0, 2.0)]
test = [(-0.5, -1.0), (0.5, 1.0)]
def mse(w, rows):
    return sum((w*x-y)**2 for x,y in rows)/len(rows)
w, best = 0.0, (float('inf'), None, None)
for epoch in range(1, 13):
    # gradient of half mean squared error
    g = sum((w*x-y)*x for x,y in train)/len(train)
    w -= 0.25*g
    score = mse(w, valid)
    if score < best[0]:
        best = (score, epoch, w)  # immutable scalar checkpoint
    print(epoch, mse(w, train), score)
print('selected', best, 'test_mse', mse(best[2], test))
```

The selected epoch is 4, w≈2.05078125, validation MSE≈.00257873535 and test MSE≈.00064468384. This tests the implementation of checkpoint restoration and the stated toy model. It does not show that validation always chooses the true optimum, or that this tiny shifted sample estimates a useful real population.

## 6. Quantify the uncertainty you actually have

For independent Bernoulli correctness outcomes from a fixed selected classifier, an approximate standard error of accuracy p̂ on n test cases is √[p̂(1−p̂)/n]. Near 0 or 1, or with small n, a simple symmetric normal interval is unreliable; a binomial interval such as Wilson is preferable. Positive within-group dependence can make row-based standard errors too small. Under general dependence, uncertainty depends on the covariance structure and the sampling unit; negative covariance can reduce variance.

To compare two models on the same cases, analyse paired outcomes. Two separate accuracy intervals discard the paired information and are not a direct significance test of their difference. Also report meaningful baseline performance, class-specific failures and the effect size. Statistical uncertainty is only one limit: neither a narrow interval nor a low p-value repairs leakage or makes a shifted population identical to the test sample.

The final exercise is the course's evidence-audit assessment. Its purpose is to connect the procedure to the claim: what was selected, which data influenced selection, what remains independent, and what could justify the next conclusion.
