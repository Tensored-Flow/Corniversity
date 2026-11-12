# Four-vectors organise the geometry

A list of four numbers becomes a four-vector because of its transformation law, not because it happens to have four entries. This distinction lets us combine independently measured energy, momentum, time and displacement without mixing frames. We use $X^\mu=(ct,x,y,z)$ and $\eta_{\mu\nu}=\operatorname{diag}(-1,1,1,1)$; repeated upper/lower indices are summed from 0 to 3.

## The metric defines the Lorentz group

For vectors $V,W$, write $V\cdot W=V^T\eta W=-V^0W^0+\mathbf V\cdot\mathbf W$. A real linear transformation preserves this bilinear form precisely when

$$\Lambda^T\eta\Lambda=\eta.$$

These matrices form $O(1,3)$. Products preserve the equation, the identity belongs to the set, and $\Lambda^{-1}=\eta\Lambda^T\eta$ follows because $\eta^{-1}=\eta$. In particular every member is invertible. This is the group of linear isometries fixing the chosen origin. Translations also preserve intervals between events; including them gives the Poincaré group rather than the Lorentz group alone.

Taking determinants gives $\det\Lambda=\pm1$. Applying the norm condition to the first column gives $-(\Lambda^0{}_0)^2+\sum_i(\Lambda^i{}_0)^2=-1$, so $|\Lambda^0{}_0|\geq1$. Therefore determinant sign and time-orientation sign cannot change continuously within the group. There are four components. The identity component $SO^+(1,3)$ has determinant+1 and $\Lambda^0{}_0\geq1$: proper, orthochronous transformations. Spatial parity $P=\operatorname{diag}(1,-1,-1,-1)$ and time reversal $T=\operatorname{diag}(-1,1,1,1)$ supply the other sign choices together with $PT$.

Why exactly four components, rather than merely at least four? An appropriate boost takes the future unit timelike first column of an orthochronous matrix to $(1,0,0,0)$. The remaining map fixes time and acts by an orthogonal spatial matrix. For determinant+1 it is a rotation, and $SO(3)$ is connected; boosts can likewise be continuously reduced to identity. Applying a fixed parity or time reversal handles each other sign choice. The reduction also explains why boosts and rotations suffice, though their ordering matters.

## Six infinitesimal directions

Write $\Lambda(\epsilon)=I+\epsilon K+O(\epsilon^2)$. Differentiation yields

$$K^T\eta+\eta K=0.$$

Equivalently $\eta K$ is an ordinary antisymmetric 4 by 4 matrix, with $4\cdot3/2=6$ independent entries. Three mix time with space and generate boosts; three are spatial rotations. This is a local dimension count, not a claim that the group contains only six matrices. The ten symmetric constraints are independent at identity: for any symmetric $S$, choosing $K=\eta S/2$ makes $K^T\eta+\eta K=S$. The implicit-function theorem gives dimension 16−10=6, and group translation gives the same dimension at every member.

Collinear boosts commute and their rapidities add. Noncollinear boosts generally do not commute; their product contains a rotation as well as a boost. The problem sheet exposes the rotation at second order, where a simple matrix multiplication is more revealing than memorising a name for the effect.

## Lower an index before contracting

Define $V_\mu=\eta_{\mu\nu}V^\nu$. In our convention $V_0=-V^0$ and $V_i=V^i$. Thus $V_\mu W^\mu$ is invariant. A lowered-index object transforms with the inverse transpose matrix, not with the same component formula as a contravariant column. We use upper/lower index position as mathematical information, never as decoration.

**Worked vector check.** Take $V=(5,3,4,0)$ in common arbitrary component units. Its norm is 0. Under an $x$ boost at $3c/5$, it becomes $V'=(4,0,4,0)$: the norm is again 0. Lowering gives $V_\mu=(-5,3,4,0)$ and $V'_\mu=(-4,0,4,0)$. The time component changed, but the null classification did not. A Euclidean four-component length would fail this check.

An event position $X$ transforms as a vector under Lorentz maps sharing an origin; under translations it gains an offset. Displacements $dX$ between events transform linearly even when origins differ. That is why physical equations should distinguish an event's affine position from a tangent vector.

## Velocity and acceleration with invariant meanings

Along a future timelike worldline, proper time is invariant. Therefore

$$U^\mu=\frac{dX^\mu}{d\tau}=\gamma(c,\mathbf v),\qquad U\cdot U=-c^2$$

transforms as a four-vector. The ordinary triple $\mathbf v$ does not: velocity addition has a denominator because both spatial and time components change. Likewise $A=dU/d\tau$ is a four-vector and differentiation gives $U\cdot A=0$. In the instantaneous rest frame $U=(c,\mathbf0)$, so $A^0=0$ and $A\cdot A=|\mathbf a_{\rm rest}|^2\geq0$. This orthogonality constrains the components; it does not mean ordinary spatial acceleration is perpendicular to spatial velocity.

**Worked circular path.** In an inertial laboratory a particle has constant speed $v$ on a circle of radius $R$. Its spatial acceleration is perpendicular to velocity and has magnitude $v^2/R$. Since $\gamma$ is constant,$A=(0,\gamma^2\mathbf a)$, so proper acceleration is $\gamma^2v^2/R$. It is nonzero even though speed and energy stay constant. Unit 9 treats the different collinear relation and its $\gamma^3$ factor.

A null worldline has $d\tau=0$, so $U=dX/d\tau$ cannot define a photon four-velocity. Photons have null four-momentum defined through energy and momentum; there is no inertial photon rest frame. Do not obtain one by putting $v=c$ into the massive four-velocity formula.

## Reading and tutorial

Tong's [*Dynamics and Relativity*, §§7.3.2 and 7.4](https://davidtong.org/pdfs/teaching/dynamics-and-relativity/dynrel7.pdf) is reference-only and uses the opposite metric sign. Taylor and Wheeler, [chapter 7 §7.2](https://www.eftaylor.com/spacetimephysics/07_chapter7.pdf), gives the geometric four-vector picture (CC BY 4.0). These notes derive their matrix facts explicitly and state the component distinction that shorthand notation can conceal.

Before solving the problems, derive the inverse formula and index-lowering rule yourself. Then test each proposed vector by its transformation law or invariant norm. The final problem uses infinitesimal boosts to connect matrix algebra with a physical difference between collinear and noncollinear frame changes.
