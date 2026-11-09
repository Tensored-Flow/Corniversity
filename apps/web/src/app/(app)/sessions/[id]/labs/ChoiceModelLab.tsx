"use client";
import {
  alphaProfile,
  type BehaviourSummary,
  ChoiceLabError,
  type ConfusionMatrix,
  type Fit,
  fitModel,
  type HeldOutResult,
  heldOutComparison,
  LAB_CASES,
  LIMITS,
  MODEL_ASSUMPTIONS,
  MODEL_IDS,
  MODEL_LABEL,
  type ModelId,
  type ModelParams,
  modelRecovery,
  parameterRecovery,
  type RecoverySummary,
  SPLIT_CONTRACT,
  type SplitKind,
  simulate,
  simulateFromFit,
  simulateGroup,
  summariseBehaviour,
  type TaskDesign,
} from "@corniversity/core/labs/index";
import { useMemo, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { ContractList, LabNote, NumberField, Plot } from "./Plot";
import { PredictionGate } from "./PredictionGate";

const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "n/a");

function paramText(p: ModelParams): string {
  if (p.model === "bias") return `b = ${fmt(p.b)}`;
  if (p.model === "wsls") return `eps = ${fmt(p.eps)}`;
  return `alpha = ${fmt(p.alpha)}, beta = ${fmt(p.beta)}`;
}

type CaseId = keyof typeof LAB_CASES;

const share = (v: number | null) => (v === null ? "n/a" : v.toFixed(2));

const MEASURE_ROWS: [string, (m: BehaviourSummary) => number | null][] = [
  ["Repeat after a reward", (m) => m.repeatAfterReward],
  ["Repeat after no reward", (m) => m.repeatAfterNoReward],
  ["Repeat after a reward, previous choice arm 0", (m) => m.repeatAfterRewardByArm[0]],
  ["Repeat after no reward, previous choice arm 0", (m) => m.repeatAfterNoRewardByArm[0]],
  ["Repeat after a reward, previous choice arm 1", (m) => m.repeatAfterRewardByArm[1]],
  ["Repeat after no reward, previous choice arm 1", (m) => m.repeatAfterNoRewardByArm[1]],
  ["Better arm in the first 10 trials", (m) => m.betterArmFirst10],
  ["Better arm in the last 10 trials", (m) => m.betterArmLast10],
];

const SPLIT_LABEL: Record<SplitKind, string> = {
  later_trials: "Later trials of the same participants",
  unseen_people: "Participants left out of the fit",
  random_trials: "Random trials (shown to expose the leak)",
};

/**
 * The complete modelling loop on a synthetic two-armed bandit: a question, three candidate
 * models with their assumptions, a design the learner can change, a prediction written before
 * any result is shown, simulation, fitting, model-independent measures with validation by
 * simulation, parameter recovery, model recovery and held-out comparisons, each comparison with
 * its information contract stated before it is run. Nothing here is a person's data.
 */
export function ChoiceModelLab({ sessionId, predictionRecorded }: { sessionId: string; predictionRecorded: boolean }) {
  const [caseId, setCaseId] = useState<CaseId>("informative");
  const lab = LAB_CASES[caseId];
  const [trials, setTrials] = useState<number>(lab.design.trials);
  const [p0, setP0] = useState<number>(lab.design.rewardProbabilities[0]);
  const [p1, setP1] = useState<number>(lab.design.rewardProbabilities[1]);
  const [region, setRegion] = useState<CaseId>("informative");
  const [generating, setGenerating] = useState<ModelId>("rw");
  const [alpha, setAlpha] = useState<number>(lab.participant.rw.alpha);
  const [beta, setBeta] = useState<number>(lab.participant.rw.beta);
  const [eps, setEps] = useState<number>(lab.participant.wsls.eps);
  const [b, setB] = useState<number>(lab.participant.bias.b);
  const [seed, setSeed] = useState(42);
  const [split, setSplit] = useState<SplitKind>("later_trials");
  const [participants, setParticipants] = useState(8);
  const [recovery, setRecovery] = useState<RecoverySummary | null>(null);
  const [confusion, setConfusion] = useState<ConfusionMatrix | null>(null);
  const [heldOut, setHeldOut] = useState<HeldOutResult | null>(null);
  const [validation, setValidation] = useState<{ key: string; summary: BehaviourSummary } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const design: TaskDesign = useMemo(() => ({ trials: Math.round(trials), rewardProbabilities: [p0, p1] }), [trials, p0, p1]);
  const ranges = LAB_CASES[region].ranges;
  const recoverySettings = LAB_CASES[region].recoverySettings;
  const preset =
    design.trials === lab.design.trials &&
    p0 === lab.design.rewardProbabilities[0] &&
    p1 === lab.design.rewardProbabilities[1] &&
    region === caseId;
  const clearResults = () => {
    setRecovery(null);
    setConfusion(null);
    setHeldOut(null);
    setValidation(null);
  };
  const chooseCase = (id: CaseId) => {
    const next = LAB_CASES[id];
    setCaseId(id);
    setTrials(next.design.trials);
    setP0(next.design.rewardProbabilities[0]);
    setP1(next.design.rewardProbabilities[1]);
    setRegion(id);
    setAlpha(next.participant.rw.alpha);
    setBeta(next.participant.rw.beta);
    setEps(next.participant.wsls.eps);
    setB(next.participant.bias.b);
    clearResults();
  };

  const params: ModelParams = useMemo(() => {
    if (generating === "bias") return { model: "bias", b };
    if (generating === "wsls") return { model: "wsls", eps };
    return { model: "rw", alpha, beta };
  }, [generating, alpha, beta, eps, b]);

  const simulated = useMemo(() => {
    try {
      return { session: simulate(params, design, seed), error: null as string | null };
    } catch (e) {
      return { session: null, error: e instanceof ChoiceLabError ? e.message : "The simulation failed." };
    }
  }, [params, design, seed]);

  const fits = useMemo(() => (simulated.session ? MODEL_IDS.map((m) => fitModel(m, [simulated.session!])) : []), [simulated.session]);
  const better = design.rewardProbabilities[1] >= design.rewardProbabilities[0] ? 1 : 0;
  const learningCurve = useMemo(() => {
    if (!simulated.session) return [];
    const out: { x: number; y: number }[] = [];
    let chosen = 0;
    simulated.session.choices.forEach((c, t) => {
      if (c === better) chosen++;
      out.push({ x: t + 1, y: chosen / (t + 1) });
    });
    return out;
  }, [simulated.session, better]);
  const rwFit = fits.find((f) => f.model === "rw");
  const winner = fits.reduce<Fit | null>((best, f) => (best === null || f.bic < best.bic ? f : best), null);
  const measures = useMemo(() => (simulated.session ? summariseBehaviour([simulated.session], design) : null), [simulated.session, design]);
  const validationKey = `${JSON.stringify(params)}|${seed}|${design.trials}|${p0}|${p1}`;
  const validated = validation?.key === validationKey ? validation.summary : null;
  const profile = useMemo(
    () => (simulated.session && rwFit?.params.model === "rw" ? alphaProfile(simulated.session, rwFit.params.beta) : []),
    [simulated.session, rwFit],
  );

  const run = (label: string, fn: () => void) => {
    setBusy(label);
    setError(null);
    // Let the button state paint before the computation blocks the page.
    setTimeout(() => {
      try {
        fn();
      } catch (e) {
        setError(e instanceof ChoiceLabError ? e.message : "The computation failed; nothing was shown in its place.");
      } finally {
        setBusy(null);
      }
    }, 20);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="slate">Synthetic participants</Badge>
        <span className="text-xs text-ink-2">
          Every choice is generated by one of the stated models from a seed. No person's data is used.
        </span>
      </div>

      <section aria-labelledby="cm-question" className="flex flex-col gap-2">
        <h3 id="cm-question" className="text-sm font-medium text-ink">
          The question
        </h3>
        <p className="text-sm text-ink-2">
          Do choices on a two-armed bandit come from learning the value of each arm, from a simple win-stay lose-shift rule, or from
          neither? And can this task, with this many trials, tell those accounts apart at all?
        </p>
        <p className="text-sm text-ink-2">
          Each trial: choose arm 0 or arm 1; a reward of 1 arrives with the arm's probability, otherwise 0. Observed: the choice and the
          reward. Nothing else.
        </p>
      </section>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="cm-case" className="text-sm font-medium text-ink">
            Case
          </label>
          <select
            id="cm-case"
            value={caseId}
            onChange={(e) => chooseCase(e.target.value as CaseId)}
            className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
          >
            <option value="informative">{LAB_CASES.informative.label}</option>
            <option value="ambiguous">{LAB_CASES.ambiguous.label}</option>
          </select>
        </div>
        <NumberField id="cm-seed" label="Seed" value={seed} onChange={(v) => setSeed(Math.max(0, Math.round(v)))} min={0} />
        <NumberField
          id="cm-trials"
          label="Trials"
          value={trials}
          onChange={(v) => {
            setTrials(Math.min(LIMITS.maxTrials, Math.max(LIMITS.minTrials, Math.round(v))));
            clearResults();
          }}
          min={LIMITS.minTrials}
          max={LIMITS.maxTrials}
          step={10}
        />
        <NumberField
          id="cm-p0"
          label="Reward probability, arm 0"
          value={p0}
          onChange={(v) => {
            setP0(Math.min(1, Math.max(0, v)));
            clearResults();
          }}
          min={0}
          max={1}
          step={0.05}
        />
        <NumberField
          id="cm-p1"
          label="Reward probability, arm 1"
          value={p1}
          onChange={(v) => {
            setP1(Math.min(1, Math.max(0, v)));
            clearResults();
          }}
          min={0}
          max={1}
          step={0.05}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="cm-region" className="text-sm font-medium text-ink">
            Participants drawn from
          </label>
          <select
            id="cm-region"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value as CaseId);
              clearResults();
            }}
            className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
          >
            <option value="informative">the informative case's region</option>
            <option value="ambiguous">the ambiguous case's region</option>
          </select>
        </div>
      </div>
      <LabNote>
        {preset ? lab.note : "A changed design: the controls differ from the case you chose."} Trials {design.trials}; reward probabilities{" "}
        {design.rewardProbabilities.join(" and ")}; recovery and held-out participants from the {region} case's region.
      </LabNote>

      <section aria-labelledby="cm-models" className="grid gap-3 sm:grid-cols-3">
        <h3 id="cm-models" className="sr-only">
          Candidate models
        </h3>
        {MODEL_IDS.map((m) => (
          <div key={m} className="rounded-[var(--radius-panel)] border border-stone bg-paper p-3">
            <p className="text-sm font-medium text-ink">{MODEL_LABEL[m]}</p>
            <ul className="mt-1 list-disc pl-4 text-xs text-ink-2">
              {MODEL_ASSUMPTIONS[m].map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <details className="rounded-[var(--radius-panel)] border border-stone bg-paper p-3">
        <summary className="cursor-pointer text-sm text-ink">One synthetic participant: the generating model (hidden by default)</summary>
        <div className="mt-2 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="cm-generating" className="text-sm font-medium text-ink">
              Generating model
            </label>
            <select
              id="cm-generating"
              value={generating}
              onChange={(e) => setGenerating(e.target.value as ModelId)}
              className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
            >
              {MODEL_IDS.map((m) => (
                <option key={m} value={m}>
                  {MODEL_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          {generating === "rw" ? (
            <>
              <NumberField id="cm-alpha" label="alpha" value={alpha} onChange={setAlpha} min={0} max={1} step={0.05} />
              <NumberField id="cm-beta" label="beta" value={beta} onChange={setBeta} min={0} max={20} step={0.5} />
            </>
          ) : generating === "wsls" ? (
            <NumberField id="cm-eps" label="eps" value={eps} onChange={setEps} min={0} max={1} step={0.05} />
          ) : (
            <NumberField id="cm-b" label="b" value={b} onChange={setB} min={0} max={1} step={0.05} />
          )}
        </div>
      </details>

      {simulated.error ? (
        <p role="alert" className="text-sm text-rust">
          {simulated.error}
        </p>
      ) : null}

      {!predictionRecorded ? (
        <PredictionGate
          sessionId={sessionId}
          labId="choice-model-loop"
          prompt="Before any result, for each case you will run: what will each model predict for repeating a choice after a reward and after no reward, and for the share of better-arm choices early and late in a session? Will model recovery tell the models apart, and which parameter will be hardest to recover? Say why."
        />
      ) : (
        <>
          {simulated.session ? (
            <Plot
              title="Simulated participant: running proportion of choices of the better arm"
              xLabel="trial"
              yLabel="proportion choosing the better arm"
              yDomain={[0, 1]}
              series={[{ label: "synthetic participant", points: learningCurve }]}
            />
          ) : null}
          <section aria-labelledby="cm-fit" className="flex flex-col gap-2">
            <h3 id="cm-fit" className="text-sm font-medium text-ink">
              Maximum-likelihood fits to this participant
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-ink-3">
                  <tr>
                    <th className="py-1 pr-3">Model</th>
                    <th className="py-1 pr-3">Fitted parameters</th>
                    <th className="py-1 pr-3">Negative log-likelihood</th>
                    <th className="py-1 pr-3">BIC</th>
                  </tr>
                </thead>
                <tbody>
                  {fits.map((f) => (
                    <tr key={f.model} className="border-t border-stone">
                      <td className="py-1 pr-3 text-ink">{MODEL_LABEL[f.model]}</td>
                      <td className="py-1 pr-3 font-mono text-xs text-ink-2">{paramText(f.params)}</td>
                      <td className="py-1 pr-3 font-mono text-xs text-ink-2">{fmt(f.nll, 1)}</td>
                      <td className="py-1 pr-3 font-mono text-xs text-ink-2">{fmt(f.bic, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <LabNote>
              Objective: the negative log-likelihood of the observed choices, minimised within the bounds (alpha in [0, 1], beta in [0, 20])
              by a grid followed by golden-section refinement, so the same data always give the same answer. BIC adds ln(trials) per
              parameter. Lower is better for both; a lower BIC for one participant is not evidence about people.
            </LabNote>
            {profile.length ? (
              <Plot
                title="How sharply the data constrain alpha (profile at the fitted beta)"
                xLabel="alpha"
                yLabel="negative log-likelihood"
                series={[{ label: "profile", points: profile.map((p) => ({ x: p.alpha, y: p.nll })) }]}
              />
            ) : null}
          </section>

          <section aria-labelledby="cm-measures" className="flex flex-col gap-2">
            <h3 id="cm-measures" className="text-sm font-medium text-ink">
              Model-independent measures, and validation by simulation
            </h3>
            <p className="text-sm text-ink-2">
              Computed from the choices and rewards alone. To validate, simulate the model with the lowest BIC, using its fitted parameters,
              and compare its behaviour with this participant's.
            </p>
            <div>
              <Button
                type="button"
                variant="secondary"
                disabled={busy !== null || winner === null}
                onClick={() =>
                  run("validate", () => {
                    if (!winner) return;
                    setValidation({
                      key: validationKey,
                      summary: summariseBehaviour(simulateFromFit(winner, design, 20, seed + 1), design),
                    });
                  })
                }
              >
                {busy === "validate" ? "Simulating…" : "Validate the winning model by simulation"}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-ink-3">
                  <tr>
                    <th className="py-1 pr-3">Measure</th>
                    <th className="py-1 pr-3">This participant</th>
                    <th className="py-1 pr-3">
                      {validated && winner
                        ? `Simulated: ${MODEL_LABEL[winner.model].toLowerCase()}, 20 sessions`
                        : "Simulated from the winning model"}
                    </th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs text-ink-2">
                  {MEASURE_ROWS.map(([label, pick]) => (
                    <tr key={label} className="border-t border-stone">
                      <th scope="row" className="py-1 pr-3 text-left font-sans font-normal text-ink">
                        {label}
                      </th>
                      <td className="py-1 pr-3">{measures ? share(pick(measures)) : "n/a"}</td>
                      <td className="py-1 pr-3">{validated ? share(pick(validated)) : "not run"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <LabNote>
              Split by the previous reward alone, repeat rates can differ even for a responder who ignores rewards, because rewards come
              mostly from the better arm; the rows that hold the previous choice fixed remove that. A model whose simulations do not
              reproduce these measures is not validated, however low its BIC.
            </LabNote>
          </section>

          <section aria-labelledby="cm-recovery" className="flex flex-col gap-2">
            <h3 id="cm-recovery" className="text-sm font-medium text-ink">
              Parameter recovery
            </h3>
            <p className="text-sm text-ink-2">
              Simulate with known Rescorla-Wagner parameters at {recoverySettings.length} settings from the {region} case's region, three
              participants each, refit, and compare.
            </p>
            <div>
              <Button
                type="button"
                variant="secondary"
                disabled={busy !== null}
                onClick={() => run("recovery", () => setRecovery(parameterRecovery(design, recoverySettings, 3, seed)))}
              >
                {busy === "recovery" ? "Fitting…" : "Run parameter recovery"}
              </Button>
            </div>
            {recovery ? (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Plot
                    title="alpha: true against recovered"
                    xLabel="true alpha"
                    yLabel="recovered alpha"
                    xDomain={[0, 1]}
                    yDomain={[0, 1]}
                    series={[
                      { label: "fits", kind: "points", points: recovery.points.map((p) => ({ x: p.trueAlpha, y: p.fitAlpha })) },
                      {
                        label: "identity",
                        dashed: true,
                        points: [
                          { x: 0, y: 0 },
                          { x: 1, y: 1 },
                        ],
                      },
                    ]}
                  />
                  <Plot
                    title="beta: true against recovered"
                    xLabel="true beta"
                    yLabel="recovered beta"
                    series={[
                      { label: "fits", kind: "points", points: recovery.points.map((p) => ({ x: p.trueBeta, y: p.fitBeta })) },
                      {
                        label: "identity",
                        dashed: true,
                        points: [
                          { x: 0, y: 0 },
                          { x: 10, y: 10 },
                        ],
                      },
                    ]}
                  />
                </div>
                <LabNote>
                  Correlation true against recovered: alpha {fmt(recovery.alphaCorrelation)}, beta {fmt(recovery.betaCorrelation)}. Mean
                  absolute error: alpha {fmt(recovery.alphaMeanAbsError)}, beta {fmt(recovery.betaMeanAbsError)}. There is no universal
                  threshold; read the systematic errors by setting below.
                </LabNote>
                <div className="overflow-x-auto">
                  <table className="text-left text-xs">
                    <thead className="uppercase tracking-wide text-ink-3">
                      <tr>
                        <th className="py-1 pr-3">True alpha</th>
                        <th className="py-1 pr-3">True beta</th>
                        <th className="py-1 pr-3">Mean error in alpha</th>
                        <th className="py-1 pr-3">Mean error in beta</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-ink-2">
                      {recovery.bySetting.map((s) => (
                        <tr key={`${s.trueAlpha}-${s.trueBeta}`} className="border-t border-stone">
                          <td className="py-1 pr-3">{s.trueAlpha}</td>
                          <td className="py-1 pr-3">{s.trueBeta}</td>
                          <td className="py-1 pr-3">{fmt(s.alphaBias)}</td>
                          <td className="py-1 pr-3">{fmt(s.betaBias)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>

          <section aria-labelledby="cm-model-recovery" className="flex flex-col gap-2">
            <h3 id="cm-model-recovery" className="text-sm font-medium text-ink">
              Model recovery
            </h3>
            <p className="text-sm text-ink-2">
              Simulate 20 participants from each model (parameters drawn from stated ranges), fit all three to each, and count which model
              has the lowest BIC.
            </p>
            <div>
              <Button
                type="button"
                variant="secondary"
                disabled={busy !== null}
                onClick={() => run("confusion", () => setConfusion(modelRecovery(design, 20, seed, ranges)))}
              >
                {busy === "confusion" ? "Fitting…" : "Run model recovery"}
              </Button>
            </div>
            {confusion ? (
              <>
                <div className="overflow-x-auto">
                  <table className="text-left text-sm">
                    <caption className="pb-1 text-left text-xs text-ink-3">
                      Rows: the model that generated the data. Columns: the model that fitted best.
                    </caption>
                    <thead className="text-xs uppercase tracking-wide text-ink-3">
                      <tr>
                        <th className="py-1 pr-3">Generated by</th>
                        {MODEL_IDS.map((m) => (
                          <th key={m} className="py-1 pr-3">
                            {m}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODEL_IDS.map((g) => (
                        <tr key={g} className="border-t border-stone">
                          <th scope="row" className="py-1 pr-3 text-left font-normal text-ink">
                            {g}
                          </th>
                          {MODEL_IDS.map((f) => (
                            <td key={f} className={`py-1 pr-3 font-mono text-xs ${f === g ? "text-ink" : "text-ink-2"}`}>
                              {fmt(confusion.probabilities[g][f])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <LabNote>
                  {confusion.diagonalDominant
                    ? "Each model is recovered as itself more often than as anything else in this case. That licenses comparing them on data from this design, not on any other."
                    : "At least one model is recovered as another more often than as itself. A comparison on data from this design would not decide between them: explain why, and propose a design that would."}
                </LabNote>
              </>
            ) : null}
          </section>

          <section aria-labelledby="cm-heldout" className="flex flex-col gap-2">
            <h3 id="cm-heldout" className="text-sm font-medium text-ink">
              Held-out comparison
            </h3>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="cm-split" className="text-sm font-medium text-ink">
                  Held-out unit
                </label>
                <select
                  id="cm-split"
                  value={split}
                  onChange={(e) => {
                    setSplit(e.target.value as SplitKind);
                    setHeldOut(null);
                  }}
                  className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
                >
                  {(Object.keys(SPLIT_LABEL) as SplitKind[]).map((s) => (
                    <option key={s} value={s}>
                      {SPLIT_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <NumberField
                id="cm-participants"
                label="Synthetic participants"
                value={participants}
                onChange={(v) => setParticipants(Math.round(v))}
                min={2}
                max={40}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={busy !== null}
                onClick={() =>
                  run("heldout", () => {
                    const group = simulateGroup(generating, participants, design, seed, ranges);
                    setHeldOut(heldOutComparison(group.sessions, split, seed));
                  })
                }
              >
                {busy === "heldout" ? "Evaluating…" : "Run the comparison"}
              </Button>
            </div>
            <ContractList contract={SPLIT_CONTRACT[split]} />
            {heldOut ? (
              <>
                <div className="overflow-x-auto">
                  <table className="text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-ink-3">
                      <tr>
                        <th className="py-1 pr-3">Model</th>
                        <th className="py-1 pr-3">Mean held-out log-likelihood per trial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODEL_IDS.map((m) => (
                        <tr key={m} className="border-t border-stone">
                          <td className="py-1 pr-3 text-ink">{MODEL_LABEL[m]}</td>
                          <td className="py-1 pr-3 font-mono text-xs text-ink-2">{fmt(heldOut.meanLogLik[m], 3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <LabNote>
                  Chance is ln 0.5 = −0.693; higher is better. {heldOut.heldOutTrials} held-out trials from {participants} synthetic
                  participants generated by {MODEL_LABEL[generating].toLowerCase()} with parameters drawn from the {region} case's region.
                </LabNote>
              </>
            ) : null}
          </section>
          {error ? (
            <p role="alert" className="text-sm text-rust">
              {error}
            </p>
          ) : null}
          <LabNote>
            The unit's report states the information contract, the fits with their uncertainty, what recovery showed, the held-out
            comparison against the baseline, and what the evidence does not settle.
          </LabNote>
        </>
      )}
    </div>
  );
}
