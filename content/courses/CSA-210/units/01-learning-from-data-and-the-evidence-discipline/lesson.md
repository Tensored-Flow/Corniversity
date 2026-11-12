## Why a deep learning course starts with evidence

The Neuromatch tutorial for day one (W1D1, Tutorial 1: PyTorch) teaches tensors, dataloaders and a first network. In Section 2.5 it loads CIFAR10 twice, once with `train=True` and once with `train=False`, and says that the split will be discussed on later days. This unit holds that discussion now, because every number you will produce in this course is worth exactly as much as the protocol that produced it. The department's convention is blunt: a metric without its data split, baseline and seed policy is not a result.

## Supervised learning as risk minimisation

**Definition (supervised learning problem).** Data $(x_i,y_i)$, $i=1,\dots,n$, drawn independently from an unknown distribution $P$ on $\mathcal X\times\mathcal Y$; a hypothesis class $\mathcal F$ of functions $f:\mathcal X\to\mathcal Y$ (for us, networks with parameters $w$); a loss $\ell(\hat y,y)\ge 0$. The *risk* of $f$ is $R(f)=\mathbb E_{(x,y)\sim P}\,\ell(f(x),y)$ and its *empirical risk* on the sample $S$ is $\hat R_S(f)=\frac1n\sum_{i=1}^n\ell(f(x_i),y_i)$. Training chooses $\hat f$ to make $\hat R_S$ small. What we care about is $R(\hat f)$, which we cannot compute.

**Definition (generalisation gap).** The quantity $R(\hat f)-\hat R_S(\hat f)$.

For a fixed $f$ chosen independently of $S$, the empirical risk is unbiased for $R(f)$ under the stated i.i.d. sampling. With bounded loss it has an error scale of order $1/\sqrt n$ for that fixed function. A fitted model depends on $S$, so this fixed-function argument cannot be applied unchanged.

A precise optimism statement is available for measurable empirical risk minimisation over a fixed nonempty hypothesis class, assuming the relevant expectations and minimiser exist:
$$\mathbb E_S[\hat R_S(\hat f)] = \mathbb E_S[\inf_{f\in\mathcal F}\hat R_S(f)] \le \inf_{f\in\mathcal F}\mathbb E_S[\hat R_S(f)] = \inf_{f\in\mathcal F}R(f) \le \mathbb E_S[R(\hat f)].$$
This is an expectation across training samples, not a guarantee of positive optimism for every sample or every arbitrary fitting algorithm. Model capacity alone does not determine a universal monotonic generalisation gap.

**Model (the held-out estimate).** Let $T$ be a second sample, independent of $S$ and of every decision used to produce $\hat f$. Conditional on $\hat f$, the terms $\ell(\hat f(x_j),y_j)$ for $(x_j,y_j)\in T$ are i.i.d. with mean $R(\hat f)$, so
$$\mathbb E\big[\hat R_T(\hat f)\,\big|\,\hat f\big]=R(\hat f).$$
The independence clause is the hypothesis doing the work. The rest of this unit is about the ways it gets violated.

## Three splits, three jobs

The training set fits parameters. The validation set chooses everything that is not a parameter: architecture, learning rate, regularisation strength, when to stop. The test set gives one final estimate. The W2D1 tutorial introduces the validation set when it discusses overfitting (its sections "Overfitting on Test Dataset" and "Validation Dataset"); the logic is the argument above applied twice.

Selecting on a set makes that set's error optimistic. If you pick the best of $m$ configurations by validation error, the winner's validation error is the minimum of $m$ noisy estimates and is biased downward. That is acceptable for the validation set, whose job is to choose. Using this selected score as an independent final estimate violates the intended evaluation condition; it should be labelled as a selection result.

**Warning.** Adapting the model or procedure in response to test results makes that set part of selection. Merely viewing an unchanged result again does not change its independence. A score after test-driven changes is still a descriptive statistic, but it generally loses the unbiased held-out-risk interpretation and needs fresh confirmation for that claim.

## Leakage

**Definition (leakage).** Information that would not be available at prediction time, or information from the evaluation data, influences the fitted model or its features by a route other than the training set.

A working taxonomy, which the exercises use:

1. *Target leakage*: a feature is a consequence of the label or is recorded after it (a "treatment started" flag used to predict a diagnosis).
2. *Preprocessing leakage*: statistics fitted on all the data before splitting: a standardiser's mean and variance, PCA directions, a vocabulary, and, worst of all, feature selection by correlation with the label.
3. *Duplicate leakage*: the same item, or an augmented copy of it, in both splits.
4. *Temporal leakage*: a random split of time-ordered data, so the model trains on the future and is tested on the past.
5. *Group leakage*: records from one patient, machine, speaker or session in both splits; the model learns the entity rather than the task.
6. *Selection leakage*: a model or hyperparameters chosen on the test set.

**Example (label-aware feature selection).** Take $n=100$ samples with a binary label and $p=10{,}000$ features that are pure noise, independent of the label. For large $n$ the sample correlation between one such feature and the label is approximately $N(0,1/n)$, so the largest of $p$ of them is roughly $\sqrt{2\ln p/n}=\sqrt{2\ln(10^4)/100}\approx 0.43$ (a derived approximation using the extreme value of nearly normal variables; this experiment is described here, not run: the unit's laboratory audits target and preprocessing leaks in a predictive-maintenance dataset instead). Select the twenty features most correlated with the label and *then* cross-validate a classifier on them: the cross-validated accuracy can be inflated above chance although the population features contain no label signal, because the selection step saw every fold's labels. Move the selection inside each fold and independent evaluation has chance-level expected predictive performance; a finite run can still fluctuate.

Preprocessing leaks are not all equal. A label-aware selection step can create a direct path for evaluation labels to influence features. Even input-only standardisation can matter under shift or small samples; the amount of score distortion is not known from a protocol description alone. Judging which leaks matter is part of the discipline, and the only honest way to find out is to rerun the pipeline without them.

## Baselines

**Model (baselines).** Before any learned model, compute (i) the majority-class or constant-prediction baseline, (ii) a simple model such as logistic regression or nearest neighbours, and (iii) any known heuristic for the task. A classifier reporting 91% accuracy on a dataset with 92% negatives is worse than predicting "negative" every time. On an imbalanced task, accuracy travels with the base rate and with per-class figures (the confusion matrix, precision and recall), because one number cannot show which errors are being made.

## Seeds and the noise in a number

Two sources of randomness enter a training run: the data (which sample we drew, how it was split) and the algorithm (initialisation, mini-batch order, dropout masks, augmentation). The tutorial's "Reproducibility" note in Section 2.1 fixes the second with a `set_seed` helper for Python, NumPy and PyTorch, and Section 2.5 seeds the dataloader workers. Fixing a seed makes a run repeatable. It does not make the number representative: run several seeds and report the mean and the spread.

**Model (sampling error of an accuracy).** If a model's true accuracy is $p$ and the test set has $n$ independent items, the number of correct predictions is $\mathrm{Binomial}(n,p)$, so the observed accuracy $\hat p$ has standard error $\sqrt{p(1-p)/n}$. With $n=200$ and $p\approx0.9$ this is about $0.021$, two percentage points. Marginal accuracies alone do not determine the uncertainty of a paired model difference; the same-item agreement pattern also matters. The exercises ask how large $n$ must be before half a point means anything, and what a paired comparison buys.

**Warning.** Reproducible is not the same as correct. A fixed seed makes a leak reproducible too.

## Tensors, briefly

Section 2 of the tutorial is the practical half of this unit: a tensor is a multidimensional array with a shape, a dtype and a device; operations broadcast across compatible shapes; a `Dataset` yields items and a `DataLoader` batches and shuffles them. Read it with the questions above in mind: where is randomness introduced, and does anything computed from the test loader ever reach training? Section 3 trains a tiny network on the full generated dataset with no split at all, which is fine for a visualisation and would be a reporting error anywhere else.

## What to carry forward

A held-out error estimates risk only if the held-out data were never used to make any decision. Leakage is any violation of that, and the worst leaks are label-aware preprocessing and selection on the test set. Every metric travels with its base rate, baseline, split and seed policy, and with its standard error. Next unit: gradients, gradient descent and backpropagation on computational graphs, where the mathematics of training begins.
