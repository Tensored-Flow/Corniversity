## The gradient as a direction

Everything in this course is trained by one idea: measure how the loss changes when the parameters move, and move the parameters the way the loss decreases fastest. The Neuromatch tutorial for W1D2 (Tutorial 1: Gradient Descent and AutoGrad) introduces the gradient, the descent step, computational graphs and PyTorch's autograd in that order; this lesson supplies the mathematics behind each.

**Definition (gradient).** For a differentiable $L:\mathbb R^d\to\mathbb R$, $\nabla L(w)$ is the vector of partial derivatives, and the first-order expansion is $L(w+\delta)=L(w)+\nabla L(w)^\top\delta+o(\|\delta\|)$.

**Proposition (steepest ascent).** If $\nabla L(w)\ne0$, among unit vectors $u$ the directional derivative $\nabla L(w)^\top u$ is largest when $u=\nabla L(w)/\|\nabla L(w)\|$.

**Proof.** By Cauchy–Schwarz, $\nabla L(w)^\top u\le\|\nabla L(w)\|\,\|u\|=\|\nabla L(w)\|$, with equality exactly when $u$ is a positive multiple of $\nabla L(w)$. $\square$

If the gradient is zero, every unit direction has zero first-order directional derivative and the normalised expression is undefined. Otherwise $-\nabla L(w)$ is the direction of steepest descent to first order (Section 1.1 of the tutorial; its Analytical Exercise 1.1 asks you to compute a gradient vector).

**Definition (gradient descent).** Choose a learning rate $\eta>0$ and iterate $w_{t+1}=w_t-\eta\,\nabla L(w_t)$ (Section 1.2).

The learning rate is not decoration. Too small and the method crawls; too large and it diverges. The one case where everything can be computed exactly tells you precisely where the boundary is.

## When it converges: the quadratic case

**Example (quadratic loss).** Let $L(w)=\tfrac12 w^\top A w-b^\top w$ with $A$ symmetric positive definite and eigenvalues $0<\lambda_1\le\dots\le\lambda_d$. The minimiser is $w^*=A^{-1}b$ and $\nabla L(w)=Aw-b=A(w-w^*)$, so
$$w_{t+1}-w^*=(I-\eta A)(w_t-w^*),\qquad w_t-w^*=(I-\eta A)^t(w_0-w^*).$$
In the eigenbasis of $A$ each error coordinate is multiplied by $1-\eta\lambda_i$ at every step. Gradient descent converges for every starting point if and only if $|1-\eta\lambda_i|<1$ for all $i$, that is
$$0<\eta<\frac{2}{\lambda_d}.$$
The per-step contraction factor is $\rho(\eta)=\max_i|1-\eta\lambda_i|=\max(|1-\eta\lambda_1|,|1-\eta\lambda_d|)$, minimised when the two are equal, at $\eta^*=2/(\lambda_1+\lambda_d)$, giving
$$\rho^*=\frac{\lambda_d-\lambda_1}{\lambda_d+\lambda_1}=\frac{\kappa-1}{\kappa+1},\qquad\kappa=\frac{\lambda_d}{\lambda_1}.$$
$\kappa$ is the condition number. For $\kappa=100$ the best rate is $\rho^*\approx0.98$, and reducing the error by a factor $100$ takes about $\ln 100/\ln(1/0.98)\approx 228$ steps. Along the stiff direction ($\lambda_d$) a large step overshoots and oscillates; along the flat direction ($\lambda_1$) the same step barely moves. This is the "poor conditioning" that the W1D4 tutorial treats and that momentum is designed to address (unit 5).

## Smooth functions: the descent lemma

Neural network losses are not quadratic, but near a point they are controlled by their curvature, and one bound on curvature is enough to guarantee progress.

**Definition ($\beta$-smooth).** $L$ is $\beta$-smooth if $\nabla L$ is $\beta$-Lipschitz: $\|\nabla L(w)-\nabla L(v)\|\le\beta\|w-v\|$ for all $w,v$. (The letter $\beta$ avoids a clash with $L$ for the loss.)

**Proposition (quadratic upper bound).** If $L$ is $\beta$-smooth then $L(v)\le L(w)+\nabla L(w)^\top(v-w)+\tfrac\beta2\|v-w\|^2$.

**Proof.** By the fundamental theorem of calculus along the segment, $L(v)-L(w)=\int_0^1\nabla L(w+s(v-w))^\top(v-w)\,ds$. Subtract and add $\nabla L(w)^\top(v-w)$; the remainder is $\int_0^1\big(\nabla L(w+s(v-w))-\nabla L(w)\big)^\top(v-w)\,ds\le\int_0^1\beta s\|v-w\|^2\,ds=\tfrac\beta2\|v-w\|^2$ by Cauchy–Schwarz and the Lipschitz bound. $\square$

**Proposition (descent lemma).** For a $\beta$-smooth $L$ and the step $w_{t+1}=w_t-\eta\nabla L(w_t)$,
$$L(w_{t+1})\le L(w_t)-\eta\Big(1-\frac{\beta\eta}{2}\Big)\|\nabla L(w_t)\|^2.$$
In particular, for $\eta\le1/\beta$, $L(w_{t+1})\le L(w_t)-\tfrac\eta2\|\nabla L(w_t)\|^2$.

**Proof.** Put $v=w_{t+1}$, $w=w_t$ in the quadratic upper bound: $v-w=-\eta\nabla L(w)$, so $\nabla L(w)^\top(v-w)=-\eta\|\nabla L(w)\|^2$ and $\tfrac\beta2\|v-w\|^2=\tfrac{\beta\eta^2}{2}\|\nabla L(w)\|^2$. $\square$

If $L$ is bounded below and a fixed step satisfies $0<\eta\le1/\beta$, summing the inequality over $t<T$ gives $\sum_{t<T}\|\nabla L(w_t)\|^2\le\tfrac2\eta\big(L(w_0)-\inf L\big)$, hence $\min_{t<T}\|\nabla L(w_t)\|^2\le\frac{2(L(w_0)-\inf L)}{\eta T}$. Under these assumptions the bound guarantees arbitrarily small gradient norms along the sequence; it does not by itself prove that the iterates converge to a point or reach a minimum. The displayed descent lemma gives strict descent at a nonzero gradient for every $0<\eta<2/\beta$. Restricting to $\eta\le1/\beta$ merely gives the convenient half-coefficient bound. For the quadratic, $\beta=\lambda_d$, so the full lemma recovers the same strict step interval as the spectral analysis.

## Computational graphs and the chain rule in reverse

**Definition (computational graph).** A directed acyclic graph whose nodes hold intermediate values $v_1,\dots,v_N$. Source nodes are inputs and parameters; every other node computes $v_j=f_j(v_{\mathrm{pa}(j)})$ from its parents by an elementary operation; a single sink holds the loss $L=v_N$. The forward pass evaluates the nodes in a topological order (tutorial Section 1.3 and Section 2.1, Forward Propagation).

**Model (reverse-mode differentiation).** Write $\bar v_i=\partial L/\partial v_i$ for the adjoint of node $i$. Then $\bar v_N=1$ and, by the multivariable chain rule applied to the children of $i$,
$$\bar v_i=\sum_{j\in\mathrm{ch}(i)}\bar v_j\,\frac{\partial v_j}{\partial v_i}.$$
Evaluating this in reverse topological order visits every edge exactly once, and every local derivative $\partial v_j/\partial v_i$ is the derivative of an elementary operation, known in closed form. The whole sweep costs a small constant multiple of the forward pass and produces $\partial L/\partial w$ for every parameter at once. Forward-mode differentiation propagates sensitivities $\dot v_j=\sum_i\dot v_i\,\partial v_j/\partial v_i$ from one chosen input direction, so the full gradient of a scalar with respect to $d$ parameters needs $d$ sweeps. With $d$ in the millions or more, this asymmetry is the reason training is possible at all. Forward mode wins in the opposite regime: few inputs, many outputs, or when a Jacobian–vector product is what you want.

**Example (backpropagation by hand).** One input $x$; hidden pre-activation $z=w_1x+b_1$; $h=\sigma(z)$ with $\sigma(z)=1/(1+e^{-z})$, so $\sigma'(z)=\sigma(z)(1-\sigma(z))=h(1-h)$; output $\hat y=w_2h+b_2$; loss $L=\tfrac12(\hat y-y)^2$. Reverse sweep:
$$\bar{\hat y}=\hat y-y,\quad \bar w_2=\bar{\hat y}\,h,\quad \bar b_2=\bar{\hat y},\quad \bar h=\bar{\hat y}\,w_2,\quad \bar z=\bar h\,h(1-h),\quad \bar w_1=\bar z\,x,\quad \bar b_1=\bar z.$$
With $x=1$, $y=0$, $w_1=0$, $b_1=0$, $w_2=1$, $b_2=0$: forward $z=0$, $h=0.5$, $\hat y=0.5$, $L=0.125$; backward $\bar{\hat y}=0.5$, $\bar w_2=0.25$, $\bar b_2=0.5$, $\bar h=0.5$, $\bar z=0.5\times0.25=0.125$, $\bar w_1=0.125$, $\bar b_1=0.125$. Check one by finite differences: raising $w_1$ by $10^{-4}$ gives $z=10^{-4}$, $h\approx0.500025$, $\hat y\approx0.500025$, $L\approx0.1250125$; the change $1.25\times10^{-5}$ over $10^{-4}$ is $0.125$, as computed. Always do one such check when you derive a gradient by hand.

In vector form, for a layer $h=\sigma(Wx+b)$ with $\bar h$ known: $\bar z=\bar h\odot\sigma'(z)$, $\bar W=\bar z\,x^\top$, $\bar b=\bar z$, $\bar x=W^\top\bar z$. The transpose is the adjoint of the linear map, which is why the method is also called the adjoint method.

## Autograd

PyTorch builds the graph while your forward code runs: tensors created with `requires_grad=True` are leaves, every operation appends a node carrying its backward function, and `loss.backward()` performs the reverse sweep (Section 2.2, Backward Propagation). Gradients are *accumulated* into each leaf's `.grad`, so a training loop (Section 3.1) reads: forward, loss, `zero_grad`, `backward`, `step`.

**Warning.** Accumulation is a feature (it lets you sum gradients over several micro-batches), but forgetting `zero_grad` silently adds the previous step's gradient to the current one and changes the algorithm you are running. A second warning: at a kink such as ReLU at $0$ the derivative does not exist; autograd returns a chosen subgradient (PyTorch uses $0$ there). This convention matters for exact-boundary behaviour and for interpreting finite-difference checks; it is not an ordinary derivative at the kink.

## Lab

The lab `gradient-descent-surface` puts a two-dimensional quadratic with eigenvalues $1$ and $10$ on the screen. Before you run anything, write down the learning rate at which you expect divergence and the rate you expect to be fastest; then run $\eta=0.05,0.1,0.18,0.21$ and watch the stiff direction oscillate. Finish with a non-convex surface and find a starting point from which gradient descent reaches a stationary point that is not the minimum.

## What to carry forward

The negative gradient is the steepest-descent direction; on a quadratic, gradient descent converges exactly when $0<\eta<2/\lambda_{\max}$, with best rate $(\kappa-1)/(\kappa+1)$; for a $\beta$-smooth function, $0<\eta<2/\beta$ guarantees strict descent at nonzero gradients. With a lower bound and fixed $0<\eta\le1/\beta$, the telescoping estimate gives small-gradient points, without by itself proving convergence of iterates. Backpropagation is the chain rule evaluated in reverse topological order; it costs about one forward pass and delivers every parameter's derivative; autograd records the graph as you compute and accumulates gradients. Next unit: multilayer perceptrons, what they can represent, and how depth and width trade off.
