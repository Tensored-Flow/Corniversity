"""Original CSA-210 capstone. Python 3 standard library, CPU only.
No network, external data, providers, or pretrained weights.
Run: python3 project_reference.py > project-results.json
"""
import copy
import hashlib
import json
import math
import platform
import random
from pathlib import Path


def dataset(n, seed, prefix, extent=1.0, nuisance_sd=3.0):
    rng = random.Random(seed)
    rows = []
    for i in range(n):
        x = [rng.uniform(-extent, extent), rng.uniform(-extent, extent),
             rng.gauss(0.0, nuisance_sd)]
        rows.append((f'{prefix}-{i:03d}', x, int(x[0]*x[1] > 0)))
    return rows


def fit_scale(rows):
    d = len(rows[0][1])
    mean = [sum(x[j] for _, x, _ in rows)/len(rows) for j in range(d)]
    sd = [math.sqrt(sum((x[j]-mean[j])**2 for _, x, _ in rows)/len(rows))
          for j in range(d)]
    return mean, [s if s > 1e-12 else 1.0 for s in sd]


def transform(rows, scale):
    mean, sd = scale
    return [(i, [(x[j]-mean[j])/sd[j] for j in range(len(mean))], y)
            for i, x, y in rows]


def pca_fit(rows):
    mean, _ = fit_scale(rows)
    centered = [[x[j]-mean[j] for j in range(3)] for _, x, _ in rows]
    cov = [[sum(x[i]*x[j] for x in centered)/len(rows)
            for j in range(3)] for i in range(3)]
    v = [1.0, 1.0, 1.0]
    for _ in range(100):
        u = [sum(cov[i][j]*v[j] for j in range(3)) for i in range(3)]
        norm = math.sqrt(sum(a*a for a in u))
        if norm == 0: raise ValueError('zero covariance has no selected direction')
        v = [a/norm for a in u]
    # Fix sign for reproducible reporting, not for changing the subspace.
    if v[2] < 0: v = [-a for a in v]
    return mean, v


def project(rows, pca):
    mean, v = pca
    return [(i, [sum((x[j]-mean[j])*v[j] for j in range(3))], y)
            for i, x, y in rows]


def sigmoid(z):
    if z >= 0: return 1.0/(1.0+math.exp(-z))
    e = math.exp(z)
    return e/(1.0+e)


def bce(z, y):
    return max(z, 0.0)-y*z+math.log1p(math.exp(-abs(z)))


class Model:
    def __init__(self, d, h, seed):
        self.d, self.h = d, h
        rng = random.Random(seed)
        if h:
            self.theta = ([rng.uniform(-1/math.sqrt(d), 1/math.sqrt(d))
                           for _ in range(h*d)] + [0.0]*h +
                          [rng.uniform(-1/math.sqrt(h), 1/math.sqrt(h))
                           for _ in range(h)] + [0.0])
            self.penalised = list(range(h*d)) + list(range(h*d+h, h*d+2*h))
        else:
            self.theta = [rng.uniform(-.1, .1) for _ in range(d)] + [0.0]
            self.penalised = list(range(d))

    def forward(self, x):
        t, d, h = self.theta, self.d, self.h
        if not h:
            return sum(t[j]*x[j] for j in range(d))+t[-1], x
        a = [math.tanh(sum(t[j*d+k]*x[k] for k in range(d))+t[h*d+j])
             for j in range(h)]
        return sum(t[h*d+h+j]*a[j] for j in range(h))+t[-1], a

    def objective_gradient(self, rows, lam):
        d, h, t = self.d, self.h, self.theta
        grad = [0.0]*len(t)
        loss = 0.0
        for _, x, y in rows:
            z, a = self.forward(x)
            loss += bce(z, y)
            delta = sigmoid(z)-y
            grad[-1] += delta
            if not h:
                for k in range(d): grad[k] += delta*x[k]
            else:
                for j in range(h):
                    grad[h*d+h+j] += delta*a[j]
                    da = delta*t[h*d+h+j]*(1-a[j]*a[j])
                    grad[h*d+j] += da
                    for k in range(d): grad[j*d+k] += da*x[k]
        grad = [g/len(rows) for g in grad]
        loss /= len(rows)
        for i in self.penalised:
            loss += .5*lam*t[i]*t[i]
            grad[i] += lam*t[i]
        return loss, grad

    def metrics(self, rows, failures=False):
        loss, correct, errors = 0.0, 0, []
        for identifier, x, y in rows:
            z, _ = self.forward(x)
            p = sigmoid(z)
            loss += bce(z, y)
            pred = int(p >= .5)
            correct += pred == y
            if pred != y:
                errors.append({'id': identifier, 'features_seen_by_model': x,
                               'target': y, 'probability': p})
        out = {'loss': loss/len(rows), 'accuracy': correct/len(rows), 'n': len(rows)}
        if failures:
            out.update(failure_count=len(errors), first_failures=errors[:5])
        return out


def fit(train, valid, h, lam, seed):
    model = Model(len(train[0][1]), h, seed)
    best = (float('inf'), None, None)
    for epoch in range(1, 251):
        objective, grad = model.objective_gradient(train, lam)
        if not math.isfinite(objective) or not all(map(math.isfinite, grad)):
            raise FloatingPointError('nonfinite training state')
        model.theta = [w-.15*g for w, g in zip(model.theta, grad)]
        val = model.metrics(valid)['loss']
        if val < best[0]:  # Strict improvement retains the earliest exact tie.
            best = (val, epoch, model.theta.copy())
    model.theta = best[2].copy()
    return model, {'seed': seed, 'epoch': best[1], 'validation_loss': best[0]}


def gradient_check(train):
    m = Model(3, 8, 11)
    lam, eps = .01, 1e-6
    _, g = m.objective_gradient(train[:7], lam)
    ids = [0, 5, 23, 24, 31, 32, 39, 40]
    errors = []
    for i in ids:
        old = m.theta[i]
        m.theta[i] = old+eps
        plus = m.objective_gradient(train[:7], lam)[0]
        m.theta[i] = old-eps
        minus = m.objective_gradient(train[:7], lam)[0]
        m.theta[i] = old
        errors.append(abs((plus-minus)/(2*eps)-g[i]))
    return {'epsilon': eps, 'coordinates': ids, 'max_absolute_error': max(errors)}


def main():
    raw_train = dataset(160, 101, 'train')
    raw_valid = dataset(80, 202, 'valid')
    scale = fit_scale(raw_train)
    train, valid = transform(raw_train, scale), transform(raw_valid, scale)
    pca = pca_fit(raw_train)
    pca_scale = fit_scale(project(raw_train, pca))
    ptrain = transform(project(raw_train, pca), pca_scale)
    pvalid = transform(project(raw_valid, pca), pca_scale)
    seeds = [11, 23, 47]
    candidates = []
    fitted = {}
    for h in (8, 16):
        for lam in (0.0, .01):
            runs = [fit(train, valid, h, lam, seed) for seed in seeds]
            score = sum(meta['validation_loss'] for _, meta in runs)/len(runs)
            candidates.append({'width': h, 'lambda': lam, 'mean_validation_loss': score,
                               'runs': [meta for _, meta in runs]})
            fitted[(h, lam)] = runs
    selected = min(candidates, key=lambda x: (x['mean_validation_loss'], x['width'], x['lambda']))
    # Baselines have fixed architectures/penalties; each uses validation to select a checkpoint.
    linear = [fit(train, valid, 0, 0.0, seed) for seed in seeds]
    pca_linear = [fit(ptrain, pvalid, 0, 0.0, seed) for seed in seeds]
    # Create final and shift evaluation data only after all selection/fitting decisions.
    raw_test = dataset(160, 303, 'test')
    raw_shift = dataset(160, 404, 'shift', extent=2.0, nuisance_sd=6.0)
    groups = [raw_train, raw_valid, raw_test, raw_shift]
    all_ids = [i for rows in groups for i, _, _ in rows]
    assert len(set(all_ids)) == len(all_ids)
    test, shift = transform(raw_test, scale), transform(raw_shift, scale)
    ptest = transform(project(raw_test, pca), pca_scale)
    pshift = transform(project(raw_shift, pca), pca_scale)
    def report(runs, data):
        return [dict(meta, parameter_count=len(m.theta),
                     **{name: m.metrics(rows, failures=name in ('test', 'shift'))
                        for name, rows in data.items()}) for m, meta in runs]
    selected_runs = fitted[(selected['width'], selected['lambda'])]
    prevalence = sum(y for _, _, y in raw_train)/len(raw_train)
    majority = int(prevalence >= .5)
    majority_results = {name: {'accuracy': sum(y == majority for _, _, y in rows)/len(rows),
                               'loss': sum(-y*math.log(prevalence)-(1-y)*math.log(1-prevalence)
                                           for _, _, y in rows)/len(rows)}
                        for name, rows in [('train', raw_train), ('test', raw_test), ('shift', raw_shift)]}
    out = {'manifest': {'python': platform.python_version(), 'data_seeds': [101,202,303,404],
                        'initialisation_seeds': seeds, 'epochs':250, 'step':.15,
                        'split_counts':[160,80,160,160], 'independent_ids':True,
                        'raw_scale':scale, 'pca_raw_mean_direction':pca, 'pca_projection_scale':pca_scale,
                        'source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                        'limitations':'Synthetic fixed datasets; seed summaries are not population confidence intervals.'},
           'gradient_check': gradient_check(train), 'candidates':candidates,
           'selected_configuration':{'width':selected['width'], 'lambda':selected['lambda']},
           'selected_mlp':report(selected_runs, {'train':train,'validation':valid,'test':test,'shift':shift}),
           'linear':report(linear, {'train':train,'validation':valid,'test':test,'shift':shift}),
           'pca_linear':report(pca_linear, {'train':ptrain,'validation':pvalid,'test':ptest,'shift':pshift}),
           'majority_baseline':majority_results}
    print(json.dumps(out, indent=2))


if __name__ == '__main__':
    main()
