# Representation learning and the final project: train, break and explain

A useful representation preserves information needed for a task while making the task easier for a chosen predictor. Reconstruction, contrastive similarity and downstream classification optimise different objectives, so success on one is not automatically success on the others. This final unit derives two representation objectives and builds a small, auditable study that connects the entire course.

Read Neuromatch W2D3 Tutorial 1 on autoencoders and latent-variable models, and W3D3 Tutorial 1 on representation similarity, self-supervised transformations and biased data. The project below uses synthetic data and original code, without downloading pretrained models, calling external services or launching large training jobs.

## 1. Reconstruction is a specified information preference

An autoencoder maps x through an encoderz=f_θ(x) and decoderx̂=g_φ(z), then minimises a reconstruction loss. A bottleneck can restrict what passes through, but its dimension alone does not identify meaningful factors. With an expressive enough model or an identity shortcut, excellent reconstruction can coexist with an unhelpful representation for the downstream task.

For centred data and a rank-k orthogonal linear reconstruction P, expected squared reconstruction error is E||x−Px||²=tr (C)−tr (PC), where C=E[xxᵀ] is covariance and P is an orthogonal projector. Choosing the top-k covariance eigenvectors maximises retained variance. This is the PCA solution. A linear autoencoder with squared error can represent the same optimal reconstruction subspace under the corresponding conditions, while its latent coordinates need not equal a unique PCA basis: invertible encoder/decoder reparameterisations can preserve reconstruction.

Suppose covariance is diag(9,1), and the target label is the sign of the second coordinate, independent of the first. A one-dimensional PCA representation keeps the first coordinate and loses the label signal, even though it minimises reconstruction error. Reconstruction gives high-variance features priority. The desired label may live in a low-variance direction. This is a concrete reason to evaluate a learned representation on the intended downstream task.

A nonlinear autoencoder can learn a different representation, but it does not inherit a guarantee that unsupervised loss discovers every useful causal factor. For any preprocessing or encoder fitted to data, define which dataset may influence it. Fitting an encoder on future test inputs is a transductive protocol, not the same inductive evaluation in which the test set was wholly unseen. Neither protocol should be silently described as the other.

## 2. Generative latent models add a distributional claim

A basic deterministic autoencoder does not by itself specify how to sample sensible latent vectors. Drawing arbitrary points in its latent space can visit regions never used by the encoder. A variational autoencoder instead specifies a priorp (z), decoder likelihoodp_θ(x|z) and approximate posteriorq_φ(z|x). Its evidence lower bound is

$$\log p_\theta (x)\ge E_{q_\phi (z|x)}[\log p_\theta (x|z)]-D_{KL}(q_\phi (z|x)\Vert p (z)).$$

One derivation writes the marginal likelihood as an expectation ofp (x, z)/q (z|x) and applies Jensen's inequality; equivalently the gap is the nonnegative KL fromq to the true posterior. Support/integrability conditions must make the expressions meaningful. The reconstruction term is a log-likelihood, not necessarily an unweighted pixel MSE; that form depends on a Gaussian observation model and variance convention.

The KL term encourages agreement with the chosen prior while the likelihood encourages data fit. A high ELBO (equivalently, a low negative-ELBO loss) does not certify that every generated sample is useful or that latent axes correspond to named real-world causes. This course introduces the mathematics and its limits; training large generative systems is outside the required project.

## 3. Contrastive learning: positives, negatives and temperature

For an anchor representationz_i, define one positive partnerz_p from a selected transformation of the same source and a candidate set C excluding the anchor itself but including the positive. With similarities s_ij and temperature τ>0, one contrastive loss is

$$L_i=-\log\frac{\exp (s_{ip}/\tau)}{\sum_{j\in C}\exp (s_{ij}/\tau)}.$$

The denominator includes both the positive and negatives. Removing the positive changes the objective and can produce a quantity that is not the negative log of a normalised candidate probability. Stable log-sum-exp prevents numerical overflow, just as in classification. The derivative with respect to the positive similarity is (p_p−1)/τ; negatives havep_j/τ.

With positive similarity 1, two negative similarities 0 and −1, and τ=.5, loss is log(1+e⁻²+e⁻⁴)≈.142932. If all three candidates have equal similarity, loss is ln3. A constant representation is therefore not the optimum when the supplied example can separate positives and negatives, but this does not prove that any optimiser avoids collapse or that every self-supervised objective has the same anti-collapse mechanism.

Choosing transformations is choosing which information to discard or preserve. If rotation changes the downstream label, treating all rotations as equivalent can erase needed signal. Negatives can also be false negatives: distinct sources may share the semantic class. Report these assumptions and evaluate more than the pretext loss. Normalised cosine similarity requires nonzero vectors or an explicit numerical zero-vector policy.

## 4. A representation evaluation must isolate its sources of improvement

To compare representations, fit encoders on the permitted training inputs, freeze them, and train the same class of downstream probe under a stated selection budget. Report random-feature, untrained or direct-input baselines when relevant. A linear probe asks how accessible the label is to a linear classifier in that representation; poor linear-probe performance does not prove that the representation contains no label information at all.

Compare equal data access and report capacity/compute differences. If a biased subset is smaller than a control dataset, a performance gap may reflect sample size as well as bias. A matched-size control helps separate these explanations. An attractive similarity heatmap can suggest a hypothesis, but task performance and controlled perturbations are needed to test it. No labels during pretraining does not mean no bias, leakage or memorisation risk.

## 5. The cumulative project

Use three synthetic input coordinates. Sample x₁, x₂ independently uniformly from [−1,1] and a nuisance z from a zero-mean Gaussian with standard deviation 3. Let the binary label be 1 exactly when x₁x₂>0. The population label is independent of z. This is a nonlinear XOR-like task with a high-variance nuisance, chosen so that architectural and representation assumptions can be inspected.

Generate independent partitions with fixed seeds:160 training examples (seed 101),80 validation (seed 202),160 final test (seed 303). Keep unique IDs with partition prefixes. The shift check uses 160 examples (seed 404) with x₁, x₂ in [−2,2] and nuisance standard deviation 6; the label rule stays fixed. These are simulated distributions, not real-world data. Fit centring/scaling only on training inputs. For the rank-one PCA representation, fit a covariance direction on the raw centred training coordinates, then fit its downstream scale on training projections. Do not standardise each raw coordinate before this particular PCA ablation: the aim is to test variance-driven loss of label information, and that choice must be reported.

Train tanh-hidden MLPs from scratch with binary cross-entropy, full-batch gradient descent and weight-only L2 penalty λ/2. Use candidate widths 8 and 16, penalties 0 and .01, three initialisation seeds 11,23,47, step .15 and 250 epochs. Save each seed's best validation-loss checkpoint, with earliest exact tie. Select the width/penalty by mean best validation loss across all three seeds; do not select a lucky seed. Evaluate every predeclared seed of the selected configuration only after selection. Report a majority baseline, a direct-input linear logistic baseline and the rank-one-PCA linear probe. An optional product-feature logistic baseline tests how a task-informed representation changes difficulty; label it as using the known synthetic construction.

The required reference implementation is standard-library Python 3 and CPU-only. It logs selected configuration, each seed's checkpoint, train/validation/final/shift metrics, baselines and errors. The instructor reference includes a complete runnable solution and its actual author-run output. Learners should first implement and predict behaviour, then compare. The model is small enough to inspect every gradient; there is no justification for a billed API call or external model training service.

## 6. Assessment blueprint and a defensible report

Before running, state predictions about raw nonlinear versus linear models, PCA's nuisance preference and the shifted inputs. Afterwards, explain discrepancies instead of deleting inconvenient results. Include a finite-difference gradient check, parameter counts, exact loss/update conventions, preprocessing statistics and partition IDs, seed-level results, failure examples and one predeclared ablation. The final exercise also asks you to connect the structural lessons of convolution and attention to this task rather than adding those architectures without a reason.

The six equally weighted capstone criteria assess mathematical implementation; data and selection discipline; reproducibility; comparisons and uncertainty; representation/failure reasoning; and integration with model assumptions. A runnable notebook or script plus an annotated report is acceptable. Report means across seeds as algorithmic summaries on a fixed dataset, not independent population confidence intervals. Do not use the shift set to retune the already selected procedure and still call it a final evaluation. If a follow-up model is designed after inspecting failures, record it as a new exploratory study needing fresh confirmation.

This closes the course by making a result reviewable: someone else should be able to reproduce the computation, identify exactly what evidence supports the claim and see where it could fail. A strong negative result with correct reasoning is better evidence than an unexamined high score.
