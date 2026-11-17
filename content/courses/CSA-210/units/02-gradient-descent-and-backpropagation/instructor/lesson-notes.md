## Lesson notes (instructor only)

Source mapping (Neuromatch Deep Learning, W1D2 Tutorial 1: Gradient Descent and AutoGrad, page opened 2026-10-30): Section 1.1 Gradients & Steepest Ascent (Analytical Exercise 1.1 gradient vector, Coding Exercise 1.1); Section 1.2 Gradient Descent Algorithm (Analytical Exercise 1.2); Section 1.3 Computational Graphs and Backprop (Analytical Exercise 1.3 chain rule, optional); Section 2.1 Forward Propagation (Coding Exercise 2.1 building a computational graph); Section 2.2 Backward Propagation; Section 3.1 Training loop in PyTorch (Coding Exercise 3.1). The tutorial's own time estimates are 30–45 minutes for each of Sections 1 and 2 and 30 minutes for Section 3. Videos were not watched and are not cited.

Teaching intent: the tutorial is operational; the lesson supplies the two analyses the learner's background makes natural (the exact quadratic case and the descent lemma) and the adjoint recursion stated as mathematics rather than as a library feature. Keep the tutorial on exercise 1 until the finite-difference check has been done; it installs the habit of never trusting a hand-derived gradient without a numerical check. Exercise 2's "only if" direction is where proofs get sloppy (oscillation at the boundary is not divergence, but it is non-convergence).

Numbers: the lesson's worked example ($x=1$, $y=0$, all-zero first layer) differs from exercise 1 ($x=(1,-1)$, $y=1.5$) so the lesson does not leak the exercise; the lesson's quadratic is general and exercise 2 instantiates $A=\operatorname{diag}(1,10)$.

Statement labels for the tutor: steepest ascent, the quadratic analysis, the descent lemma and the adjoint recursion are derived; the PyTorch behaviours (dynamic graph, accumulation into `.grad`, zero subgradient for ReLU at 0) are source-backed from the tutorial and PyTorch's documented behaviour and should be labelled "needs checking" if the learner's installed version differs.

Lab `gradient-descent-surface`: prediction-first protocol. The learner should predict nonconvergence by nondecaying oscillation at $\eta=0.2$, and divergence in the stiff direction for larger positive steps and fastest convergence near $0.18$ before running; a learner who predicts "smaller is always better" has the first misconception of the unit and the lab will correct it visibly.

Staged misconception for a peer discussion, if enabled: a classmate may claim "autograd differentiates the Python code symbolically, so it would be slow for big models". The tutor resolves it with the edge-count argument: one reverse sweep, each edge once.
