# Sequences and attention: content, position and information boundaries

Sequence modelling asks which parts of an ordered input are relevant to each output. A recurrent model carries state through time, while attention directly forms weighted combinations of representations at selected positions. This unit computes that operation, proves a symmetry and audits the masks that protect prediction-time information. Read Neuromatch W3D1 Tutorial 1 sections 1–7; we use its mathematical attention context without claiming that a small tutorial represents the current frontier of language modelling.

## 1. From a recurrent state to a set of candidate memories

A simple recurrent model updates h_t=φ(W_hh_{t−1}+W_xx_t+b). Shared parameters encode a sequential rule; the state at time t can depend on earlier inputs through repeated composition. Long chains of Jacobians can shrink or amplify gradients, and computation along the sequence is sequential. These are mechanisms to analyse, not a claim that every recurrent model fails at all long dependencies.

Attention instead gives each query a collection of keys and associated values. A score expresses compatibility; normalised scores determine a weighted combination of values. In self-attention, queries, keys and values are projections of the same sequence; in cross-attention, queries may come from one sequence and keys/values from another. Neither definition guarantees that the weights constitute a faithful causal explanation of a prediction.

## 2. Derive the scaled dot-product computation

Use row-token convention X∈Rⁿˣᵈ. Let Q=XW_Q∈Rⁿˣᵈᵏ, K=XW_K∈Rⁿˣᵈᵏ and V=XW_V∈Rⁿˣᵈᵛ. Then

$$S=QK^\top/\sqrt{d_k},\qquad A=\operatorname{softmax}_{row}(S),\qquad O=AV.$$

Each row of A sums to 1 and has nonnegative entries, so each output row is a convex combination of value rows before later output projections. If the components of q and k are independent, zero-mean and unit-variance with suitable cross-independence, Var (q·k)=d_k. Dividing by √d_k then controls the initial score scale under those assumptions. Learned representations need not retain those distributional assumptions; scaling is a design choice with a motivation, not a guarantee against softmax saturation.

Attention is linear in V when A is held fixed. Full self-attention is generally nonlinear in X because Q, K and therefore A depend on X. It is misleading to call the whole operation a fixed linear operator. Even when projection weights are fixed, changing inputs changes the attention weights.

For d_k=1, query ln3, keys 1 and 0, scores are ln3 and 0. Their softmax is (3/4,1/4). With value rows (2,0) and (0,4), output is (1.5,1). A zero query gives equal scores and output (1,2). This illustrates content-dependent weighting without any linguistic interpretation.

## 3. Masks are part of the model

A padding mask excludes artificial padding positions from the candidate keys. A causal mask permits a token at position t to attend only to allowed positions ≤t for a next-token decoder. Apply exclusion before softmax, conceptually replacing forbidden scores by −∞. Setting a forbidden score to zero does not exclude it: exp0 is 1. A row with no allowed keys has an undefined probability normalisation and must be prevented or handled by an explicit policy rather than silently producing NaN.

In teacher-forced next-token learning, an input prefix token at position t predicts the next token. Inputs and targets must be shifted correctly; a causal mask alone does not repair a target accidentally included at the same prediction position. At generation, only the actually available prefix is input. Validation and test should use the same information boundary as the claimed task.

Bidirectional encoder tasks may legitimately attend to both directions when the complete input is available. A causal mask is not universally “safer”; the mask must match the prediction task. For forecasting or missing-data reconstruction, explicitly state which observations are available at each output.

## 4. Position and permutation

Without positional information or an order-dependent mask, self-attention is permutation equivariant. For permutation matrix P, Q'=PQ, K'=PK, V'=PV. Scores become PSPᵀ and row softmax satisfies A'=PAPᵀ, so O'=PO. If an invariant pooling operator averages token outputs, the pooled representation cannot distinguish a sequence from a permutation of the same tokens in this setting.

Positional embeddings or encodings break that symmetry by associating different representations with positions. A causal mask also introduces an order-dependent structure, so the unmasked symmetry proof must not be applied unchanged to it. Position encodings can be fixed sinusoidal functions, learned vectors or other stated schemes. Extending a positional scheme to longer sequences does not by itself demonstrate reliable length generalisation.

Residual connections add the incoming representation to a transformed one, helping information and gradients flow through depth. Layer normalisation acts on specified feature axes with learned scale/offset; the ordering of normalisation and residual branches is part of the architecture. A position-wise feed-forward block adds nonlinear feature processing. The same feed-forward weights are shared across token positions; attention is the component that mixes tokens in this simple block.

## 5. Multihead attention and cost

Several heads compute separate projections and weighting patterns, concatenate their outputs and project back to model width. For the standard convention h heads of width d/h with total projected width d, the Q, K, V and output matrices together contain 4d² weights, plus 4d biases if all are used. Some tutorial implementations give every head width d instead, which changes parameter counts. Inspect the declared dimensions; “eight heads” is not enough information.

Dense attention forms n×n scores per head. Its score storage scales as batch·h·n², and score/value matrix multiplications scale roughly as n²d for fixed total width. More efficient implementations can reduce stored intermediates, but do not make an arbitrary full attention matrix a free object. At sequence length 2048, batch 2, heads 8, a single float32 score tensor contains 67,108,864 numbers, or 256MiB. Doubling length quadruples this tensor size. This count excludes gradients, values and other model states.

## 6. A small complete attention calculation

The original standard-library function below demonstrates stable row softmax with explicit allowed keys. It is deterministic and uses supplied arrays, so it is an operator check with no statistical dataset split. The final problem extends its tests to causal leakage and permutations.

```python
import math
def attention(Q, K, V, allowed):
    out, weights = [], []
    for i, q in enumerate(Q):
        ids = [j for j in range(len(K)) if allowed(i, j)]
        if not ids:
            raise ValueError('attention row has no allowed key')
        s = [sum(a*b for a,b in zip(q,K[j]))/math.sqrt(len(q))
             for j in ids]
        m = max(s)
        e = [math.exp(z-m) for z in s]
        p = [z/sum(e) for z in e]
        row = [0.0]*len(K)
        for j, weight in zip(ids,p): row[j] = weight
        weights.append(row)
        out.append([sum(row[j]*V[j][k] for j in ids)
                    for k in range(len(V[0]))])
    return out, weights
```

In production-quality code also validate compatible dimensions and finite inputs; the course reference implementation includes those checks. Numerical row sums and exact masks are useful tests, but do not establish semantic understanding. Evaluate sequence predictions with a declared split, baseline, tokenisation fitted on permitted data, selection protocol and failure analysis. A plausible output is not a factuality certificate; generation quality requires task-specific evidence beyond a training loss.
