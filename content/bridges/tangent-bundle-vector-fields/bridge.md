## One vector, many component lists

A tangent vector $v \in T_pM$ exists before any coordinates are chosen. A chart $x = (x^1, \dots, x^n)$ near $p$ gives a basis $\partial/\partial x^1, \dots, \partial/\partial x^n$ of $T_pM$, and $v$ has components there:

$$v = v^i \frac{\partial}{\partial x^i}\qquad(\text{summation over } i).$$

In a second chart $x'$ the same vector has different components $v'^i$. The relation follows from the chain rule. If $v$ is the velocity of a curve $\gamma$, then in the two charts its components are $\tfrac{d}{dt}x^i(\gamma(t))$ and $\tfrac{d}{dt}x'^i(\gamma(t))$, and

$$\boxed{\,v'^i = \frac{\partial x'^i}{\partial x^j}\, v^j\,}$$

with the Jacobian of the transition map evaluated at $p$. This is exactly the relation by which a tangent vector can be *defined*: a pair (chart, vector of components), with two pairs identified when their components are related by the derivative of the transition map.

## Covectors transform the other way

A covector (a linear map $\omega: T_pM \to \mathbb{R}$, such as the differential $df$) has components $\omega_i = \omega(\partial/\partial x^i)$, so $\omega = \omega_i\,dx^i$. The number $\omega(v) = \omega_i v^i$ cannot depend on the chart. Since the $v^i$ change by the Jacobian, the $\omega_i$ must change by its inverse:

$$\boxed{\,\omega'_i = \frac{\partial x^j}{\partial x'^i}\,\omega_j\,}$$

The two Jacobians $\partial x'/\partial x$ and $\partial x/\partial x'$ are inverse matrices, which is what makes $\omega_i v^i$ invariant. This upper/lower index bookkeeping is the whole content of "tensor transformation laws": each upper index transforms with $\partial x'/\partial x$, each lower index with $\partial x/\partial x'$.

## Worked example: the Euclidean metric in polar coordinates

A Riemannian metric is a symmetric covariant 2-tensor, $g = g_{ij}\,dx^i\,dx^j$, so its components carry two lower indices and transform with two inverse Jacobians:
$g'_{kl} = \frac{\partial x^i}{\partial x'^k}\frac{\partial x^j}{\partial x'^l}\,g_{ij}$.

On $\mathbb{R}^2$ the Euclidean metric is $dx^2 + dy^2$. With $x = r\cos\theta$, $y = r\sin\theta$:

$$dx = \cos\theta\,dr - r\sin\theta\,d\theta,\qquad dy = \sin\theta\,dr + r\cos\theta\,d\theta,$$

and substituting,

$$dx^2 + dy^2 = dr^2 + r^2\,d\theta^2.$$

The metric did not change; only its components did, from the identity matrix to $\operatorname{diag}(1, r^2)$. The determinant $r^2$ vanishes at $r = 0$, but nothing is wrong with the plane there: the polar chart simply fails to be a chart at the origin. Telling a **coordinate singularity** (a defect of the chart) from a genuine property of the geometry is exactly the skill MAT-262's first unit asks for, and the transformation law is the tool: a genuine invariant, such as curvature or the length of a curve, comes out the same in every chart.

## A habit worth keeping

When you see an expression with indices, ask what kind of object it is. If it is a tangent vector, its components must change with $\partial x'/\partial x$; if a covector or a metric, with $\partial x/\partial x'$ once per lower index. An expression that does not transform correctly (for example, the partial derivatives of a vector field's components, $\partial_j v^i$) is not a tensor, which is precisely why a connection is needed in the next unit.
