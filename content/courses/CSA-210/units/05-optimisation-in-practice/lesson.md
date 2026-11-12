# Optimisation: condition the question before tuning the optimiser

An optimiser maps local gradient information and stored state into a parameter update. It does not know which test population you care about. Training loss, validation performance, computation and numerical stability therefore need separate measurements. This unit uses exact quadratics to understand conditioning, then adds momentum, sampling noise and adaptive scaling. Read Neuromatch W1D4 Tutorial 1 sections 4,6,7 for the corresponding tutorial context.

## 1. A quadratic exposes the stability limit

Let L(w)=½wᵀHw with H symmetric positive definite. Orthogonally diagonalise H=QΛQᵀ and set z=Qᵀw. Gradient descent w_{t+1}=w_t−ηHw_t becomes z_{i, t+1}=(1−ηλ_i) z_{i, t}. Every component converges to zero exactly when |1−ηλ_i|<1, or 0<η<2/λ_max. Equality at the upper boundary allows a nondecaying sign flip in the largest-eigenvalue direction. An initial state missing that direction can hide instability; a stability guarantee must cover all initial states.

For H=diag(1,100), η=.01 kills the steep component in one step but shrinks the shallow component only by .99 each step. The condition number κ=100 explains the competing scales. The best constant step for worst-case parameter contraction is η=2/(λ_min+λ_max), giving factor(κ−1)/(κ+1). This statement concerns the Euclidean error on this SPD quadratic, not an arbitrary nonconvex neural-network loss.

Feature scaling can change the Hessian and make optimisation easier, but scaling statistics must be fitted on training data. Standardisation is not a harmless excuse to inspect validation or test distributions. A diagonal preconditioner P gives w_new=w−ηP∇L; appropriate positive scaling can improve conditioning, while arbitrary scaling can change stability. For this known diagonal quadratic P=diag(1,.01) produces an identity effective curvature and reaches zero in one η=1 step. Real problems do not usually hand us their exact Hessian inverse.

## 2. Momentum has a state and a convention

Use the heavy-ball convention v_{t+1}=βv_t+g_t, w_{t+1}=w_t−ηv_{t+1}, with v₀=0. An alternative convention stores the actual parameter displacement and puts −η inside its recurrence; they are equivalent after a consistent change of variables, not if pieces are mixed. Along a quadratic eigenmode,

$$z_{t+1}=(1+\beta-\eta\lambda) z_t-\beta z_{t-1}.$$

The roots of r²−(1+β−ηλ) r+β=0 determine behaviour. Momentum can accelerate a well-conditioned direction choice or create oscillation and instability. For 0≤β<1 and positiveλ, a sufficient-and-necessary strict stability interval for this scalar recurrence is 0<ηλ<2(1+β). The derivation uses the roots being inside the unit disk; it does not say that every stable setting is fast or that loss decreases at every step.

On known SPD quadratics, special choices using λ_min and λ_max give strong asymptotic rates. Those constants are usually unavailable in deep learning, so a controlled search and learning traces remain necessary. An attractive two-dimensional trajectory is evidence about that objective and initialisation, not proof of universal superiority.

## 3. Mini-batches estimate a chosen empirical gradient

For empirical mean loss L=(1/N)Σℓ_i, let g_i=∇ℓ_i (w). Uniformly sampling one index gives E[g_i]=∇L. Averaging b independent draws with replacement gives covariance Cov (g_batch)=Cov (g_i)/b. With a finite dataset sampled without replacement, the variance includes a finite-population correction; reshuffled batches across an epoch are also dependent. State the sampling rule before invoking the 1/b formula.

Unbiasedness is conditional on the current parameter and the sampling mechanism. Class-balanced sampling without compensating weights can estimate a different objective. An unweighted average of unequal-sized batch means can misweight examples. Batch size also changes memory use, gradient evaluations per update and the number of updates in an epoch. Compare both example-processing budget and update count when comparing optimisers.

Smaller stochastic steps introduce variability, not a theorem that they always find a better minimum. Random seeds help reproduce a run, while multiple predeclared seeds reveal some training variation. Seed replication alone does not measure uncertainty from a different sampled dataset or a shifted deployment population.

## 4. Adaptive scaling and its limits

RMSprop keeps an exponentially weighted second moment s_t=ρs_{t−1}+(1−ρ) g_t², with elementwise squares. A stated convention is w_{t+1}=w_t−ηg_t/(√s_t+ε). Some implementations instead place ε inside the square root. These are different numerical rules, especially for small s_t. The second moment E[g²] is not a centred variance unless the mean gradient is zero.

Adam also keeps m_t=β₁m_{t−1}+(1−β₁) g_t, and uses bias-corrected estimates m̂_t=m_t/(1−β₁ᵗ), ŝ_t=s_t/(1−β₂ᵗ) from zero initial states. Its stated update is w_new=w−ηm̂/(√ŝ+ε). Bias correction compensates for initial zero-state shrinkage under a stationary moment model; it does not remove stochastic noise or guarantee global convergence. Adaptive methods still need a learning rate, monitoring and a fair selection protocol.

Adding an L2 penalty to the gradient before adaptive scaling is generally different from applying an independent multiplicative weight decay. The next unit derives that distinction. Avoid claiming an optimiser “fixes conditioning” in every problem merely because it rescales coordinates.

## 5. A controlled numerical experiment

The following standard-library code compares two predetermined GD steps on the same exact objective. There is no dataset, fitting split or randomness: this is a numerical stability investigation, not a performance benchmark. It prints the exact analytic trajectory as a check.

```python
def run(eta, steps=20):
    w = [1.0, 1.0]
    for _ in range(steps):
        g = [w[0], 100*w[1]]
        w = [w[i]-eta*g[i] for i in range(2)]
    exact = [(1-eta)**steps, (1-100*eta)**steps]
    return w, exact, 0.5*(w[0]**2+100*w[1]**2)
for eta in (0.01, 0.021):
    print(eta, run(eta))
```

At η=.021 the steep multiplier is −1.1; an increasing magnitude is predicted before running anything. A good experiment includes such a failure case. For learned models, decide the search space on training/validation information, choose using validation, and reserve test evaluation for the fixed procedure. Report failed runs, stopping conditions, nonfinite values, computation budget and seed policy. Removing inconvenient runs after seeing their results changes what your average means.
