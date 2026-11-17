# Deep linear networks: simple functions, nonlinear learning dynamics

A deep linear network is deliberately restricted. It cannot create the nonlinear decision boundaries of the previous unit, yet training its factors is not the same optimisation problem as training their product directly. That makes it a useful setting for studying depth, initialisation, singular modes and representation measurements without confusing those questions with an unexplained large model.

Read Neuromatch W1D2 Tutorial 3, sections on deep linear nets, SVD, representational similarity and transient correlations. These notes derive a narrow solvable case. We do not treat a visual pattern in a tutorial as a universal theorem about how all neural networks learn.

## 1. Linear in inputs does not mean convex in parameters

For column vectors, f (x)=W₂W₁x with W₁∈Rʰˣᵈ and W₂∈Rᶜˣʰ. The product M=W₂W₁ is linear in x. With squared error, optimising M directly is a convex problem, but the factorised objective is generally nonconvex in the pair (W₁, W₂). There are many parameter settings for the same function. If R is invertible, W₂R⁻¹ and RW₁ have the same product. This is a representation symmetry, not an extra predictive achievement.

The hidden width bounds rank (M)≤h. A width-one network cannot represent a rank-two target matrix even with more linear layers. Adding biases makes the overall map affine; it does not remove this rank constraint on its linear part. Adding a nonlinear activation changes the function class and invalidates the purely linear analysis.

For input matrix X with samples as columns and target Y, define L=½||W₂W₁X−Y||²_F. If E=W₂W₁X−Y, differentiation gives ∇W₂=E(W₁X)ᵀ and ∇W₁=W₂ᵀEXᵀ. A mean loss would divide these by the chosen sample count; this factor changes the effective learning-rate/time convention. Record it before comparing formulas or code.

## 2. SVD is a coordinate system, not automatic decoupling

Any real target matrix T has a singular value decomposition T=UΣVᵀ. Right singular vectors specify input directions, left singular vectors output directions, and nonnegative singular values quantify amplification between them. For a rectangular matrix, Σ is rectangular in a full SVD; a reduced SVD retains only the relevant dimensions. Singular values are not automatically explained variances: for a centred data matrix, squared singular values relate to covariance eigenvalues after the appropriate normalisation.

Under whitened input covariance, squared loss can reduce to a Frobenius error between M and T up to a scale. If the factors are aligned to the singular-vector bases and remain diagonal in those coordinates, each mode can evolve separately. The alignment/whitening conditions do the work. Merely taking the SVD of a network at each time does not prove that arbitrary training dynamics have independent modes. Data correlations, finite-step updates and nonlinear layers can couple behaviour.

A small rank example is T=diag(3,1). The rank-one approximation diag(3,0) has squared Frobenius error 1, whereas diag(0,1) has error 9. Keeping the strongest singular direction is optimal here. An elementary proof for any rank-one candidate uses its nontrivial null direction v: ||T−M||_F≥||(T−M) v||=||Tv||≥1 for unit v. The candidate achieves the bound. This is an approximation statement, not a guarantee that a chosen training procedure reaches that optimum.

## 3. Solve a single balanced mode

Let the target scalar be s>0, the prediction q=ab, and loss L=½(ab−s)². Continuous-time gradient flow satisfies da/dt=(s−ab) b and db/dt=(s−ab) a. Subtracting derivatives gives d (a²−b²)/dt=0. If a(0)=b(0)>0, equality persists and q=a² obeys

$$\frac{dq}{dt}=2q (s-q).$$

Separating variables yields

$$q (t)=\frac{s}{1+(s/q_0-1) e^{-2st}},\qquad 0<q_0<s.$$

Small initial q grows slowly at first on a plot of loss, then approaches s. Time to fraction α of the target is t_α=(1/(2s)) ln[(s/q₀−1)/(1/α−1)], provided αs≥q₀. With common small initial q₀, a larger s often reaches a given fraction sooner in this special regime. The exact time formula, not a universal “important features first” slogan, is the claim we can justify.

At a=b=0 both gradients vanish despite positive loss. That is a stationary point, not a useful fit. An unbalanced or opposite-sign initialisation changes the dynamics; the balanced positive solution cannot simply be pasted onto it. Discrete gradient descent is an approximation to gradient flow, and a large step can overshoot or diverge even when the differential equation converges.

## 4. A reproducible numerical investigation

The following standard-library program compares the solvable flow with explicit Euler integration of the factor equations. It is a deterministic model calculation, not a statistical generalisation experiment: no dataset or random seed is used. Change dt to test numerical error before interpreting differences as learning phenomena.

```python
import math
s, q0, duration = 2.0, 0.04, 1.0
def exact(t):
    return s/(1+(s/q0-1)*math.exp(-2*s*t))
def run(dt):
    steps = round(duration/dt)
    a = b = math.sqrt(q0)
    for _ in range(steps):
        e = s-a*b
        da, db = e*b, e*a  # same old state
        a, b = a+dt*da, b+dt*db
    return a*b
for dt in (0.02, 0.01, 0.005):
    print(dt, run(dt), exact(duration), abs(run(dt)-exact(duration)))
```

The exact value at t=1 is about 1.054037. Decreasing dt should move this stable short simulation toward that value; exact equality is not expected. Replacing simultaneous updates by sequential in-place ones solves a different numerical scheme. Keep the loss convention, duration and initial state fixed when comparing results.

## 5. Representation similarity needs a declared metric

Put row representations h_i into H. The Gram matrix G=HHᵀ contains dot products. Cosine similarity is G_ij/(||h_i||||h_j||) for nonzero rows; these are not the same without normalisation. Scaling one representation changes its dot products but not its cosine similarities. A zero vector has no defined cosine direction; any numerical fallback should be reported.

An orthogonal hidden-coordinate change H→HR preserves HHᵀ. A general invertible change need not. Yet a corresponding inverse change in the output layer preserves the network function. Thus two functionally identical deep linear networks can have different raw representation similarity matrices. A claim about “the meaning” of a representation needs an explicit measurement, controlled transformations and relevant task evidence.

## 6. What a transient can and cannot establish

A partially trained model may show a feature association that later changes as other modes develop. That observation can be described and predicted within a synthetic model. It does not establish human-like concepts, causal understanding, or a guarantee that longer training always improves held-out performance. Later units show why stopping can protect against fitting noise. Here the valuable habit is narrower: write a solvable model, test its assumptions and make a prediction before looking at the numerical trace.
