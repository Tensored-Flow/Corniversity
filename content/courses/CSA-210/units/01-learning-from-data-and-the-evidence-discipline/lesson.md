## Why a deep learning course starts with evidence

The Neuromatch tutorial for day one (W1D1, Tutorial 1: PyTorch) teaches tensors, dataloaders and a first network. In Section 2.5 it loads CIFAR10 twice, once with `train=True` and once with `train=False`, and says that the split will be discussed on later days. This unit holds that discussion now, because every number you will produce in this course is worth exactly as much as the protocol that produced it. The department's convention is blunt: a metric without its data split, baseline and seed policy is not a result.

## Supervised learning as risk minimisation

**Definition (supervised learning problem).** Data $(x_i,y_i)$, $i=1,\dots,n$, drawn independently from an unknown distribution $P$ on $\mathcal X\times\mathcal Y$; a hypothesis class $\mathcal F$ of functions $f:\mathcal X\to\mathcal Y$ (for us, networks with parameters $w$); a loss $\ell(\hat y,y)\ge 0$. The *risk* of $f$ is $R(f)=\mathbb E_{(x,y)\sim P}\,\ell(f(x),y)$ and its *empirical risk* on the sample $S$ is $\hat R_S(f)=\frac1n\sum_{i=1}^n\ell(f(x_i),y_i)$. Training chooses $\hat f$ to make $\hat R_S$ small. What we care about is $R(\hat f)$, which we cannot compute.

**Definition (generalisation gap).** The quantity $R(\hat f)-\hat R_S(\hat f)$.

For a *fixed* $f$ chosen without looking at $S$, $\hat R_S(f)$ is an average of i.i.d. terms with mean $R(f)$: it is unbiased, and if the loss is bounded it concentrates around $R(f)$ at rate $1/\sqrt n$. For $\hat f$ this fails. $\hat f$ was selected to make $\hat R_S$ small, so $\hat R_S(\hat f)$ is biased downward, by an amount that grows with the capacity of $\mathcal F$ and that a network with millions of parameters can make enormous (unit 6 shows networks fitting random labels). This is the whole reason for held-out data.

**Model (the held-out estimate).** Let $T$ be a second sample, independent of $S$ and of every decision used to produce $\hat f$. Conditional on $\hat f$, the terms $\ell(\hat f(x_j),y_j)$ for $(x_j,y_j)\in T$ are i.i.d. with mean $R(\hat f)$, so
$$\mathbb E\big[\hat R_T(\hat f)\,\big|\,\hat f\big]=R(\hat f).$$
The independence clause is the hypothesis doing the work. The rest of this unit is about the ways it gets violated.

## Three splits, three jobs

The training set fits parameters. The validation set chooses everything that is not a parameter: architecture, learning rate, regularisation strength, when to stop. The test set gives one final estimate. The W2D1 tutorial introduces the validation set when it discusses overfitting (its sections "Overfitting on Test Dataset" and "Validation Dataset"); the logic is the argument above applied twice.

Selecting on a set makes that set's error optimistic. If you pick the best of $m$ configurations by validation error, the winner's validation error is the minimum of $m$ noisy estimates and is biased downward. That is acceptable for the validation set, whose job is to choose. It is fatal for the test set, whose job is to estimate.

**Warning.** Looking at the test set more than once silently converts it into a validation set. A test error obtained after you "fixed a few things" because the first test number disappointed you is not an estimate of anything.

## Leakage

**Definition (leakage).** Information that would not be available at prediction time, or information from the evaluation data, influences the fitted model or its features by a route other than the training set.

A working taxonomy, which the exercises use:

1. *Target leakage*: a feature is a consequence of the label or is recorded after it (a "treatment started" flag used to predict a diagnosis).
2. *Preprocessing leakage*: statistics fitted on all the data before splitting: a standardiser's mean and variance, PCA directions, a vocabulary, and, worst of all, feature selection by correlation with the label.
3. *Duplicate leakage*: the same item, or an augmented copy of it, in both splits.
4. *Temporal leakage*: a random split of time-ordered data, so the model trains on the future and is tested on the past.
5. *Group leakage*: records from one patient, machine, speaker or session in both splits; the model learns the entity rather than the task.
6. *Selection leakage*: a model or hyperparameters chosen on the test set.

**Example (label-aware feature selection).** Take $n=100$ samples with a binary label and $p=10{,}000$ features that are pure noise, independent of the label. For large $n$ the sample correlation between one such feature and the label is approximately $N(0,1/n)$, so the largest of $p$ of them is roughly $\sqrt{2\ln p/n}=\sqrt{2\ln(10^4)/100}\approx 0.43$ (a derived approximation using the extreme value of nearly normal variables; the lab is the evidence). Select the twenty features most correlated with the label and *then* cross-validate a classifier on them: the cross-validated accuracy sits well above chance although nothing is predictable, because the selection step saw every fold's labels. Move the selection inside each fold and the accuracy returns to chance.

Preprocessing leaks are not all equal. Standardising with the full-data mean usually moves a result very little; label-aware selection destroys it. Judging which leaks matter is part of the discipline, and the only honest way to find out is to rerun the pipeline without them.

## Baselines

**Model (baselines).** Before any learned model, compute (i) the majority-class or constant-prediction baseline, (ii) a simple model such as logistic regression or nearest neighbours, and (iii) any known heuristic for the task. A classifier reporting 91% accuracy on a dataset with 92% negatives is worse than predicting "negative" every time. On an imbalanced task, accuracy travels with the base rate and with per-class figures (the confusion matrix, precision and recall), because one number cannot show which errors are being made.

## Seeds and the noise in a number

Two sources of randomness enter a training run: the data (which sample we drew, how it was split) and the algorithm (initialisation, mini-batch order, dropout masks, augmentation). The tutorial's "Reproducibility" note in Section 2.1 fixes the second with a `set_seed` helper for Python, NumPy and PyTorch, and Section 2.5 seeds the dataloader workers. Fixing a seed makes a run repeatable. It does not make the number representative: run several seeds and report the mean and the spread.

**Model (sampling error of an accuracy).** If a model's true accuracy is $p$ and the test set has $n$ independent items, the number of correct predictions is $\mathrm{Binomial}(n,p)$, so the observed accuracy $\hat p$ has standard error $\sqrt{p(1-p)/n}$. With $n=200$ and $p\approx0.9$ this is about $0.021$, two percentage points. Two models that differ by one point on such a test set are indistinguishable by this evidence alone. The exercises ask how large $n$ must be before half a point means anything, and what a paired comparison buys.

**Warning.** Reproducible is not the same as correct. A fixed seed makes a leak reproducible too.

## Tensors, briefly

Section 2 of the tutorial is the practical half of this unit: a tensor is a multidimensional array with a shape, a dtype and a device; operations broadcast across compatible shapes; a `Dataset` yields items and a `DataLoader` batches and shuffles them. Read it with the questions above in mind: where is randomness introduced, and does anything computed from the test loader ever reach training? Section 3 trains a tiny network on the full generated dataset with no split at all, which is fine for a visualisation and would be a reporting error anywhere else.

## What to carry forward

A held-out error estimates risk only if the held-out data were never used to make any decision. Leakage is any violation of that, and the worst leaks are label-aware preprocessing and selection on the test set. Every metric travels with its base rate, baseline, split and seed policy, and with its standard error. Next unit: gradients, gradient descent and backpropagation on computational graphs, where the mathematics of training begins.
