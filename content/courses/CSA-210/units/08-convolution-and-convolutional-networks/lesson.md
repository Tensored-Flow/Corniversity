# Convolutional networks: locality, sharing and the boundaries of equivariance

A convolutional layer makes a structural bet: nearby patterns matter, and the same local detector can be useful at many positions. That reduces parameter count and introduces a translation relationship. It does not guarantee that a whole network is invariant to every shift. Read Neuromatch W2D2 Tutorial 1 sections 2–4 and the transfer-learning overview. The definitions here make kernel orientation, boundaries and sampling explicit.

## 1. Define the operation before computing it

Many deep-learning libraries call the following cross-correlation a convolution:

$$y[n]=\sum_{k=0}^{K-1}w[k]x[n+k].$$

Mathematical convolution instead uses a reversed relative argument, such as Σ_k w[k]x[n−k]. A learned kernel can absorb the reversal, but hand calculations must agree on the convention. Here all finite examples use the cross-correlation above unless stated otherwise. With x=(1,3,2,0) and w=(1,−1), valid output is (−2,1,2). There are no padded values in that example.

For fixed kernelw, this operator is linear in x: applying it to αx+βz gives αC_wx+βC_wz by distributing the sum. It is also linear in w when x is fixed, but jointly it is bilinear, not linear in the pair (x, w). A nonzero bias makes the layer affine in x; a following ReLU makes the block nonlinear. Separate these statements when explaining the network.

A matrix representation exposes the same operation: valid length-four input and a length-two kernel (a, b) produce a3×4 matrix with rows (a, b,0,0),(0, a, b,0),(0,0, a, b). Repeated entries express weight sharing. The transpose maps output gradients back to input coordinates in reverse-mode differentiation. It is not generally an inverse: this rectangular matrix loses information, and even a square convolution matrix can be singular.

## 2. Translation equivariance has assumptions

On an infinite sequence, define (T_sx)[n]=x[n−s]. Then C_w (T_sx)[n]=Σ_kw[k]x[n+k−s]=(T_sC_wx)[n]. This is equivariance: translating the input translates the output. Invariance would instead mean the output stays unchanged. A shifted edge should normally move its detector response, not erase its position.

Finite arrays require a boundary rule: zero, circular, reflected or valid-only handling. A circular convolution is equivariant to circular shifts. A finite zero-padded same-size layer does not generally commute with a shift followed by truncation at the boundary. Interior positions can retain the expected relation while edge positions differ. State which shift operator is being tested; moving pixels off an image is not an invertible translation on that finite space.

Stride subsamples the response. Stride 2 generally preserves a compatible relationship to input shifts by multiples of 2, not arbitrary one-pixel shifts. Pooling also discards information. Local max pooling can give some robustness to small movements within a window, but crossing a window boundary can change its output. Global pooling can produce an invariant summary under a compatible permutation/translation of the feature map, while losing location information needed for localisation.

## 3. Shapes, channels and parameter counts

For one spatial dimension with input length N, symmetric padding P, kernel length K, dilation D and stride S, output length is

$$\left\lfloor\frac{N+2P-D(K-1)-1}{S}\right\rfloor+1,$$

assuming a nonempty valid placement range. Dilation spaces kernel taps, giving effective extentD(K−1)+1. Apply the same formula separately to height and width. A batch dimension changes how many examples are processed, not the number of learned kernel parameters.

A standard ungrouped 2D layer with C_in input channels, C_out output channels and K_h×K_w kernels has C_out C_in K_h K_w weights plus C_out biases if used. Each output channel sums contributions from every input channel. Spatial output size affects computation and activation memory, but not this weight count. Grouped or depthwise layers have different connectivity and therefore different counts; do not silently apply the full-connectivity formula to them.

For input 32×32 with 3 channels,8 output channels,3×3 kernels, stride 2, padding 1 and dilation 1, spatial output is 16×16 and parameter count 8(3·9+1)=224. A dense map from all 3072 input pixels to 2048 output scalars would require 3072·2048+2048 parameters. The two operations are different hypotheses: parameter savings do not by themselves prove the convolutional one is adequate for a task.

## 4. Receptive fields and information loss

A receptive field identifies which input coordinates can affect an output. Let j be the input spacing between neighbouring positions at a layer, initially 1, and r the receptive-field width, initially 1. A layer with effective kernel extent k and stride S updates r_new=r+(k−1) j and j_new=Sj. For two 3-tap stride 1 layers, r grows 1→3→5. A stride 2 layer increases the jump for later layers. This is a geometric potential influence, not a statement that every input has equal learned influence.

Average pooling is linear for a fixed window and boundary rule. Max pooling is nonlinear: max (x+z) need not equalmax (x)+max (z). Its derivative routes through maximising entries when the maximum is unique; ties need a convention. Both pooling and stride can alias high-frequency patterns. If preserving a small spatial detail is essential, test whether the architecture destroys it before the final layer can use it.

## 5. A complete local operator check

This original standard-library program computes a valid cross-correlation and its matrix-equivalent input gradient for a supplied upstream vector. It is deterministic algebra, so there are no fitted data splits or random seeds. Later learned-kernel experiments must add those evaluation controls.

```python
x, w, g = [1.,3.,2.,0.], [1.,-1.], [2.,-1.,3.]
y = [sum(w[k]*x[n+k] for k in range(len(w)))
     for n in range(len(x)-len(w)+1)]
dx = [0.]*len(x)
dw = [0.]*len(w)
for n in range(len(y)):
    for k in range(len(w)):
        dx[n+k] += g[n]*w[k]
        dw[k] += g[n]*x[n+k]
print(y, dx, dw)
# [-2,1,2], [2,-3,4,-3], [5,4]
```

The overlap causes several output gradients to accumulate into one input gradient. Assignment instead of accumulation silently loses paths in the computational graph. Finite differences of the scalarg·y provide an independent numerical check of bothdx anddw.

## 6. Transfer learning is a procedure requiring evidence

A pretrained representation may provide useful features or a good initialisation. Compare frozen-feature, fine-tuned and from-scratch baselines under a stated budget, and fit any downstream preprocessing only on training data. Pretraining provenance matters: if evaluation examples or close duplicates appeared during pretraining, the intended independence claim may not hold. Fine-tuning and feature selection still use validation, not the final test.

Do not infer that a feature is medically, scientifically or causally meaningful just because a filter resembles an edge or a model performs well. Report the target population, input transformations, failure cases and computation. The final exercise combines the operator mathematics with an architecture audit, including a shift counterexample and an explicit evidence plan.
