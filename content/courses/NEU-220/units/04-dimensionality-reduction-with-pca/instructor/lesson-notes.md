## Lesson notes (instructor only)

**Source mapping (all opened 2026-10-30).** Neuromatch W1D4 chapter page (Intro, Tutorials 1–4, Outro, further reading, day summary). Tutorial 1: generate correlated bivariate normal data (stand-ins for two neurons' firing rates), define an arbitrary orthonormal basis, project. Tutorial 2: sample covariance Σ̂ = XᵀX/N for mean-subtracted data, eigenvectors, projection S = XW, eigenvalues; 1000 samples from a zero-mean bivariate Gaussian; bonus on the mathematical basis of PCA. Tutorial 3: PCA on MNIST (70,000 images, 28 × 28 pixels), scree plot, variance explained, reconstruction with different numbers of components, visualisation of weights, bonus denoising. Tutorial 4: MNIST in 2D with PCA and t-SNE, first 2,000 samples via fetch_openml. Licence footer CC BY 4.0 on every page.

**Teaching intent.** Prove the eigen-characterisation (the tutorial states it; exercise 1 proves it), connect eigenvalues to variance explained and reconstruction error, and drive home "variance is not relevance" with a constructed counterexample. The data-origin discipline matters especially here because none of the W1D4 data are neural; the lesson and exercise 3 say so repeatedly.

**Tutor behaviour (dev-anantharaman).** Ask what preprocessing was done before any PCA plot is interpreted; ask what target variable would define relevance; refuse quantitative readings of t-SNE distances; label the Gaussian data synthetic and MNIST as images every time.

**Re-pacing.** W1D4 is a four-tutorial Neuromatch day; here one teaching week with the proof carrying the extra time.
