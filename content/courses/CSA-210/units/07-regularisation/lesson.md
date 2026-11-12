# Regularisation: specify which preference you are introducing

Regularisation changes a learning procedure's preference among possible fits. A penalty, stochastic masking, augmentation and early stopping do not all do the same thing. Each introduces assumptions and tuning decisions that must be tested against the intended task. Read Neuromatch W2D1 Tutorial 2 on L1/L2, dropout, augmentation and hyperparameter selection; the equations here state the exact coefficient and optimiser conventions.

## 1. A penalty defines a different objective

For training mean loss L(w), define ridge-style objective J₂=L(w)+(λ/2)||w||²₂ with λ≥0. Its gradient is ∇L+λw. The factor ½ is a convention: a source using λ||w||² has gradient 2λw and therefore a different numerical meaning for the symbol λ. State whether biases and normalisation parameters are penalised and whether L is a sum or a mean. Otherwise reported coefficients cannot be compared.

On squared regression L=½||Xw−y||² with XᵀX=I, the stationary equation is (I+λI) w=Xᵀy, giving ŵ₂=Xᵀy/(1+λ). Every coordinate shrinks continuously toward 0. Without orthogonality, the solution is (XᵀX+λI)⁻¹Xᵀy when λ>0, but feature scaling changes the geometry of the penalty. A coefficient measured in metres and one measured in millimetres should not be penalised as though units were irrelevant.

For J₁=L+λ||w||₁ in the orthogonal case, solve each scalar problem ½(w−z)²+λ|w|. If w>0, derivative w−z+λ=0; if w<0, derivative w−z−λ=0; at 0 the subgradient interval is [−λ,λ]. Thus

$$\hat w_1=\operatorname{sign}(z)\max(|z|-\lambda,0).$$

This soft threshold can set coordinates exactly to zero. It does not mean that an ordinary fixed-step sign-gradient update always lands exactly at zero or that L1 universally selects the true features. Correlated predictors, noise and the selected λ influence the result. Proximal-gradient updates apply a gradient step for the smooth loss followed by soft thresholding at ηλ, which handles the nonsmooth corner explicitly.

## 2. Weight decay depends on the optimiser

With plain GD, the L2 update is w_new=(1−ηλ) w−η∇L, so it equals multiplicative decay with the matching coefficient. Under a preconditioner P, addingλw before scaling gives w_new=w−ηP(∇L+λw). Independently decaying weights gives w_new=(1−ηλ) w−ηP∇L. These differ unless P acts like the identity on the penalised directions, or coefficients are adjusted accordingly. Adaptive methods also maintain state influenced by gradients, so their history can deepen the difference.

This distinction matters when interpreting a setting named weight_decay. Do not infer its mathematics from the label alone; inspect the algorithm's documented update. A smaller parameter norm is also representation-dependent: rescaling adjacent homogeneous layers can preserve the represented function while changing individual layer norms. A norm penalty is a specified inductive preference, not a universal numerical measure of semantic complexity.

## 3. Dropout preserves a conditional mean, not every output

For fixed activationa and independent maskm∼Bernoulli (q), inverted dropout uses ã=ma/q, whereq is the keep probability. Then E[ã]=a and Var (ã)=a²(1−q)/q. Independent masks on coordinates give the covariance needed to compute the variance of a linear combination. At evaluation, the usual deterministic model uses the unmasked activation with this scaling convention.

For a linear outputz=Σw_ia_i and targety, independent dropout yields

$$E[(\tilde z-y)^2]=(z-y)^2+\frac{1-q}{q}\sum_i w_i^2a_i^2.$$

This exact statement for a linear output and squared loss illustrates a data-dependent regularising term. It does not say that a deep nonlinear network's deterministic evaluation equals the average of every masked network. Generally E[φ(Z)]≠φ(E[Z]). Training-mode stochasticity and gradient recording are separate controls, as in unit 3.

For a=(2,−1), unit output weights and q=.5, possible outputs are 0,4,−2,2 with equal probabilities. Their mean is 1, variance 5 and mean square 6. The unmasked output has square 1. These numbers give a concrete check of what is preserved and what is not. Mask dependence or a different drop/keep convention changes the calculation.

## 4. Augmentation is a claim about the task

If a transformationT preserves the desired label, training on (Tx, y) can encourage invariance. If the correct output should transform predictably, the task instead requires equivariance. Flipping an image can preserve a category label while changing left/right localisation coordinates. Rotating a6 into a9 can change a digit label. Blindly reusing labels can train systematic errors rather than provide free data.

Augment only after splitting by original example or group. Augmented descendants of the same source must not cross into an evaluation set intended to contain unseen sources. Augmentation does not create independent observations: ten crops of one image are not ten newly sampled subjects. Evaluation transformations, if used, are part of the selected procedure and should be declared before test inspection.

The distribution of transformations encodes an assumption about nuisance variation. Aggressive noise can erase predictive information; a transformation that preserves labels in one dataset may fail in another setting. Test a proposed invariance against representative examples and state which failure cases remain.

## 5. Select a procedure, not an attractive isolated run

Choose regularisation strengths and augmentation settings using training/validation information. Predeclare the candidate range, metric, seed set and computational budget. A small log-spaced set of positive penalties plus an unpenalised baseline is often a useful controlled experiment. This is a study design choice, not a claim that a certain search method is universally best. Report the full candidate results rather than only the winner.

When several regularisers are combined, their effects may interact. Adding strong dropout to an already narrow, heavily penalised model may underfit. An ablation changes one component under a stated budget to help attribute an observed difference. It still needs uncertainty and representative data; a single winning seed does not establish a stable effect. The final course project supplies a tiny complete pipeline on which to practise these distinctions.

## 6. A numerical check with a closed-form target

The following original standard-library enumeration is exact and deterministic. It checks the dropout calculation without a dataset or a seed. A separate seeded Monte Carlo check is useful for seeing sampling error, but should approach these exact expectations rather than replace their derivation.

```python
import itertools
values = [2*m1*2 + 2*m2*(-1)
          for m1,m2 in itertools.product((0,1), repeat=2)]
mean = sum(values)/len(values)
variance = sum((z-mean)**2 for z in values)/len(values)
print(values, mean, variance)  # [0, -2, 4, 2], 1.0, 5.0
```

Before interpreting a regularisation experiment, say what the intervention changes: the objective, the noisy training computation, the effective data distribution, or the stopping rule. Then identify the exact held-out evidence that could justify choosing it. That reasoning is more transferable than remembering a preferred penalty value.
