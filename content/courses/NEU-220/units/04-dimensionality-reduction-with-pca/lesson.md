## Why reduce dimensions

A population recording gives one number per neuron per time bin: a point in a space with as many dimensions as neurons, hundreds in the Steinmetz data of unit 3. Nobody can look at that space directly, and many methods struggle in it. Dimensionality reduction asks whether the data occupy, approximately, a much smaller subspace, and if so which one. W1D4 builds the standard answer, principal component analysis, from geometry, and then shows its limits. Be clear from the start about the data: Tutorials 1 and 2 simulate Gaussian data standing in for the rates of two neurons, and Tutorials 3 and 4 use MNIST, 70,000 images of handwritten digits with 784 pixels each. Nothing in this unit is a recording. The methods transfer to neural data; the results do not.

## The geometric view

**Definition (orthonormal basis and projection).** Vectors $\mathbf{w}_1, \dots, \mathbf{w}_D$ in $\mathbb{R}^D$ form an orthonormal basis if $\mathbf{w}_i^\top\mathbf{w}_j = \delta_{ij}$. The coordinate of a data point $\mathbf{x}$ along $\mathbf{w}_i$ is the projection $s_i = \mathbf{x}^\top\mathbf{w}_i$, and $\mathbf{x} = \sum_i s_i\mathbf{w}_i$ exactly. Changing basis loses nothing (Tutorial 1). Reduction begins when we keep only some of the $s_i$.

Collect $N$ centred observations (each variable with its mean subtracted) as the rows of $\mathbf{X}$ ($N \times D$). The **sample covariance** is $\boldsymbol\Sigma = \mathbf{X}^\top\mathbf{X}/N$ (Tutorial 2 writes it this way; the $N - 1$ convention changes nothing below). The variance of the projected coordinates along a unit vector $\mathbf{w}$ is
$$\text{Var}(\mathbf{X}\mathbf{w}) = \frac{1}{N}\|\mathbf{X}\mathbf{w}\|^2 = \mathbf{w}^\top\boldsymbol\Sigma\mathbf{w},$$
a quadratic form in $\mathbf{w}$. In Tutorial 1 the two simulated neurons are correlated, and rotating the basis changes how the variance is split between the two coordinates; some direction carries the most.

## Principal component analysis

**Model.** PCA chooses the orthonormal basis that puts as much variance as possible into the first coordinate, then as much of the rest as possible into the second, and so on. The result is that the basis vectors are the eigenvectors of $\boldsymbol\Sigma$, ordered by eigenvalue, and the variance along the $k$th component equals the $k$th eigenvalue $\lambda_k$. Exercise 1 asks you to prove this and to show that the component scores are mutually uncorrelated. Writing the eigenvectors as the columns of $\mathbf{W}$, the scores are $\mathbf{S} = \mathbf{X}\mathbf{W}$ (Tutorial 2).

**Example.** Two centred variables with covariance $\boldsymbol\Sigma = \begin{pmatrix}2 & 1\\ 1 & 2\end{pmatrix}$. The characteristic equation $(2 - \lambda)^2 - 1 = 0$ gives $\lambda = 3$ and $\lambda = 1$, with eigenvectors $(1, 1)/\sqrt2$ and $(1, -1)/\sqrt2$. The first component is the direction along which the two variables move together; it carries $3/(3 + 1) = 75\%$ of the total variance. The second, the direction along which they move oppositely, carries $25\%$.

Two conventions matter and are often skipped. **Centring** is required: without it the first component points at the mean rather than at the direction of spread. **Scaling** is a choice: if one neuron's rate is in spikes per second and another's in spikes per minute, the second dominates the covariance for no reason; standardising each variable to unit variance (PCA on the correlation matrix) removes units but also removes real differences in variability. State which you did.

## Variance explained and reconstruction

Because the eigenvalues sum to the total variance (the trace of $\boldsymbol\Sigma$), the fraction of variance explained by the first $K$ components is $\sum_{k \le K}\lambda_k / \sum_k\lambda_k$, and a plot of $\lambda_k$ against $k$ is a **scree plot** (Tutorial 3). Reconstructing a point from its first $K$ scores, $\hat{\mathbf{x}} = \sum_{k \le K}s_k\mathbf{w}_k$, incurs an error whose mean squared norm over the data is exactly the sum of the discarded eigenvalues, $\sum_{k > K}\lambda_k$. Exercise 2 uses both identities.

**Example.** Synthetic eigenvalues $4, 3, 2, 1$ (total $10$): two components explain $70\%$ and the mean squared reconstruction error with two components is $2 + 1 = 3$. In Tutorial 3 you reconstruct MNIST digits from a growing number of components and watch them sharpen; the bonus shows that discarding low-variance components can remove pixel noise, because the noise is spread thinly across all directions while the digit structure concentrates in a few. That is a fact about those images, demonstrated on those images.

**Warning.** "Variance explained" is a statement about the data's spread, not about information. Nothing in PCA knows what the experiment was about. A population's largest variance direction may be a slow drift in arousal, a shared noise fluctuation, or a movement signal; the stimulus or decision variable you care about may live in a component that explains two percent of the variance. Deciding relevance requires a target variable and a method that uses it (regression, a decoder, or a supervised reduction). The scree-plot "elbow" tells you how many components reproduce the data to a tolerance, which is a different question.

## Nonlinear embeddings

PCA finds a linear subspace. If the data lie on a curved manifold, two PCA dimensions can superimpose structure that is separate in the full space. Tutorial 4 compares a two-dimensional PCA of MNIST with **t-SNE**, which places points in the plane so that neighbours in the high-dimensional space remain neighbours. The digits separate into islands under t-SNE where PCA shows overlapping clouds.

**Definition (what t-SNE preserves).** t-SNE preserves local neighbourhood structure at a scale set by its perplexity parameter. It does not preserve global distances: the distance between two islands, and the size of an island, carry no reliable meaning, and both change with the perplexity and the random seed. Read a t-SNE plot for "which points are near which", never for "how far apart are the groups" or "how spread out is this group".

## From images to neurons

The tutorials' data were chosen for clarity: Gaussian clouds whose covariance you set, and images whose categories you know. A real population recording differs in ways that matter for every step above. Spike counts have Poisson-like variance that grows with the mean, so high-rate neurons dominate an unscaled covariance for reasons of noise, not signal. Trial-to-trial variability mixes with stimulus-driven variability unless you decide, and say, whether you analyse single trials or trial averages. Recordings are non-stationary over an hour. And the question of what the low-dimensional structure means cannot be answered from the structure alone. Exercise 3 asks you to lay these differences out, for the synthetic Gaussian data, for MNIST, and for a hypothetical recording, and to say in each case what the plots can and cannot show.

## What to carry forward

PCA rotates to the eigenbasis of the covariance, ordering directions by variance; variance explained and reconstruction error follow from the eigenvalues; centring and scaling are decisions. Variance is not relevance, and t-SNE neighbourhoods are not distances. None of this unit's data were neurons. Next unit, outlined: deep networks as decoders and as normative encoding models.
