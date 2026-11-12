# Multilayer perceptrons: what depth adds, and what it does not promise

A multilayer perceptron composes affine maps with nonlinearities. That small change from linear regression creates flexible decision boundaries, but also changes optimisation, parameter identifiability and the relationship between training error and generalisation. This unit studies those changes through explicit constructions rather than a claim that a sufficiently large network will automatically learn any task.

Read Neuromatch W1D3 Tutorial 1, the ReLU approximation, MLP construction and classification sections, and Tutorial 2 on width/depth comparisons. Our constructions and problems are original. The source's discussion of universal approximation is motivation; the precise claim here separates representability from learning and evaluation.

## 1. Keep the shapes visible

For one column input x∈Rᵈ, an MLP with hidden width h and c outputs is z=W₁x+b₁, a=φ(z), ℓ=W₂a+b₂. W₁ is h×d and W₂ is c×h. It has hd+h+ch+c trainable scalar parameters. For a batch represented as rows X∈Rⁿˣᵈ, the same computation uses Z=XW₁ᵀ+1b₁ᵀ. Mixing these conventions without transposes is a common source of code that either fails or computes a different map.

If φ is the identity, composition collapses to W₂W₁x+(W₂b₁+b₂): depth has not expanded the class beyond affine functions. A narrow hidden layer can constrain the rank. Nonlinearity prevents this collapse. ReLU(z)=max(0, z) is piecewise linear and continuous; a ReLU network is piecewise affine as a function of its input, with regions determined by activation patterns. It is not globally linear merely because each region is affine.

For widths 2→3→1 the parameter count is 6+3+3+1=13. A wider or deeper architecture is not automatically a fairer comparison: parameter count, compute budget, optimiser settings and search effort should all be reported. Equal parameter count alone does not equal equal training cost.

## 2. Build a function from slope changes

A one-dimensional continuous piecewise-linear function with knots t₁<⋯<t_m can be written

$$f (x)=a+bx+\sum_{j=1}^m c_j\operatorname{ReLU}(x-t_j),$$

where b is the slope before the first knot and c_j is the change in slope at knot j. Each hidden ReLU switches on an additional slope. This is an exact representation, not a statement about whether gradient descent will discover it.

For the triangular function f (x)=ReLU(x)−2ReLU(x−1)+ReLU(x−2), the slope is 0, then 1, then −1, then 0 on the four intervals. It peaks at 1 when x=1 and vanishes outside [0,2]. This construction shows how local features can arise from globally active affine pieces. A linear term bx can itself be written b (ReLU(x)−ReLU(−x)) if a strict network representation is required.

Piecewise-linear interpolation of a twice continuously differentiable function on a compact interval has uniform error at most Mh²/8 when |f''|≤M and the largest grid spacing is h. One route uses the standard two-node interpolation remainder f (x)−p (x)=f''(ξ)(x−a)(x−b)/2 inside a cell; the product magnitude is at most h²/4. Refining the grid therefore gives a constructive approximation argument in one dimension. It does not establish a sample-complexity bound, successful training, extrapolation, or the needed width in high dimensions.

The following original Python 3 experiment needs only the standard library. Knots are construction data, the midpoint grid is a separate evaluation set, and there is no hyperparameter selection. The function is noiseless and synthetic; the result is interpolation evidence on this interval only.

```python
import math
n = 8
knots = [i/n for i in range(n+1)]
y = [x*x for x in knots]
slopes = [(y[i+1]-y[i])*n for i in range(n)]
def model(x):
    return y[0] + slopes[0]*x + sum(
        (slopes[i]-slopes[i-1])*max(0.0, x-knots[i])
        for i in range(1, n))
checks = [(i+0.5)/n for i in range(n)]
print(max(abs(model(x)-x*x) for x in checks))
# 0.00390625; bound M*h*h/8 with M=2 is identical.
```

## 3. Classification: logits are not probabilities

For logits ℓ_j, softmax p_j=exp(ℓ_j)/Σ_k exp(ℓ_k). The cross-entropy loss for a true class y is −ℓ_y+logΣ_k exp(ℓ_k). Adding a common constant to every logit changes neither probabilities nor loss. Numerically, subtract m=max_jℓ_j inside the exponentials: logΣexpℓ=m+logΣexp(ℓ−m). This avoids overflow while preserving the mathematics.

Differentiate the loss to obtain ∂L/∂ℓ_j=p_j−1[j=y]. A model confidently wrong in one class therefore receives a gradient pushing the true logit up and competing logits down. Softmax couples the outputs; applying separate independent binary losses describes a different task when labels are mutually exclusive. For binary output z, sigmoid (z) gives the positive-class probability and a stable loss is max (z,0)−yz+log(1+exp(−|z|)).

Do not feed already-softmaxed probabilities into a loss routine that expects logits. Likewise, “evaluation mode” and “disable gradient recording” are different operations in frameworks: one changes behaviour of modules such as dropout, the other changes bookkeeping for derivatives. A purely deterministic small MLP may hide this distinction until more layers are added.

## 4. Backpropagation meets a nonsmooth activation

At z≠0, ReLU derivative is 1 for z>0 and 0 for z<0. At 0 there is no ordinary derivative; implementations choose a convention, commonly 0. Gradient checks should avoid kink points or explicitly analyse one-sided derivatives. A hidden unit inactive on all training inputs can have zero gradient for its incoming weights in that region. This is an optimisation issue, not proof that the task has no useful representation.

For squared loss L=½(f−y)², the output error f−y is propagated through output weights and then masked by active ReLUs. Every parameter gradient must be computed from the same forward-state parameters before an update. Updating one layer and then using its new weights to differentiate another is not the gradient of the original loss.

## 5. Representation, optimisation and evidence are separate obligations

XOR is a useful finite construction: a hidden nonlinear representation can separate four points that one affine threshold cannot. It does not show that a trained MLP generalises to a realistic population. Conversely failure of one training run does not prove an architecture cannot represent a function. Diagnose capacity with constructions or approximation arguments; optimisation with gradients, loss traces and controlled initialisation; generalisation with held-out data sampled for the intended use.

Use train data to fit weights, validation data to select widths and training decisions, and an untouched test set for the final selected procedure. Reusing the test set while comparing architectures turns it into validation data, regardless of its variable name. Later units develop that protocol into an actual small training study. This sheet first makes the network's mathematical behaviour transparent enough that you can audit that study.
