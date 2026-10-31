"use client";
import {
  CONDITIONS,
  type Condition,
  DEFAULT_SETTINGS,
  type Episode,
  key,
  PlanningLabError,
  runTransfer,
  TRANSFER_CONTRACT,
  type TransferRun,
  type World,
} from "@corniversity/core/labs/index";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { LabNote, NumberField, Plot } from "./Plot";
import { PredictionGate } from "./PredictionGate";

const CELL = 34;

function Grid({
  world,
  paths,
  title,
  oldGoal,
}: {
  world: World;
  paths: { label: string; color: string; episode: Episode }[];
  title: string;
  oldGoal?: readonly [number, number];
}) {
  const w = world.layout.cols * CELL;
  const h = world.layout.rows * CELL;
  const centre = (c: readonly [number, number]) => [c[1] * CELL + CELL / 2, c[0] * CELL + CELL / 2] as const;
  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full max-w-sm" role="img" aria-label={title}>
        <title>{title}</title>
        {Array.from({ length: world.layout.rows }, (_, r) =>
          Array.from({ length: world.layout.cols }, (_, c) => (
            <rect
              key={`${r}-${c}`}
              x={c * CELL}
              y={r * CELL}
              width={CELL}
              height={CELL}
              fill={world.layout.walls.has(key([r, c])) ? "var(--ink-2)" : "var(--paper-2)"}
              stroke="var(--stone)"
            />
          )),
        )}
        {paths.map((p, i) => (
          <polyline
            key={p.label}
            fill="none"
            stroke={p.color}
            strokeWidth={i === 0 ? 4 : 2.5}
            strokeDasharray={i === 0 ? undefined : "5 3"}
            strokeLinejoin="round"
            points={p.episode.path
              .slice(0, 120)
              .map((c) => centre(c).join(","))
              .join(" ")}
          />
        ))}
        {oldGoal ? (
          <text x={centre(oldGoal)[0]} y={centre(oldGoal)[1] + 5} textAnchor="middle" fontSize="13" fill="var(--ink-3)">
            old
          </text>
        ) : null}
        <text
          x={centre(world.start)[0]}
          y={centre(world.start)[1] + 5}
          textAnchor="middle"
          fontSize="15"
          fontWeight="600"
          fill="var(--ink)"
        >
          S
        </text>
        <text x={centre(world.goal)[0]} y={centre(world.goal)[1] + 5} textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--moss)">
          G
        </text>
      </svg>
      <figcaption className="text-xs text-ink-3">{title}</figcaption>
    </figure>
  );
}

/**
 * A model-based planner and a cached policy on a small grid, and a changed world. The learner
 * reads the transfer test's information contract, chooses the change, writes a prediction, then
 * sees what each strategy did on every episode after the change and how the difference looks
 * when averaged over more episodes.
 */
export function PlanningLab({ sessionId, predictionRecorded }: { sessionId: string; predictionRecorded: boolean }) {
  const [condition, setCondition] = useState<Condition>("revaluation");
  const [epsilon, setEpsilon] = useState(DEFAULT_SETTINGS.epsilon);
  const [alpha, setAlpha] = useState(DEFAULT_SETTINGS.alpha);
  const [training, setTraining] = useState(DEFAULT_SETTINGS.trainingEpisodes);
  const [seed, setSeed] = useState(1);
  const spec = CONDITIONS[condition];

  const result: { run: TransferRun | null; error: string | null } = useMemo(() => {
    try {
      return {
        run: runTransfer(condition, { ...DEFAULT_SETTINGS, epsilon, alpha, trainingEpisodes: Math.round(training) }, seed),
        error: null,
      };
    } catch (e) {
      return { run: null, error: e instanceof PlanningLabError ? e.message : "The simulation failed." };
    }
  }, [condition, epsilon, alpha, training, seed]);
  const run = result.run;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="slate">Synthetic agents</Badge>
        <span className="text-xs text-ink-2">
          Two programmed strategies on one grid with deterministic moves; nothing here is a person's behaviour.
        </span>
      </div>
      <section aria-labelledby="pl-strategies" className="grid gap-3 sm:grid-cols-2">
        <h3 id="pl-strategies" className="sr-only">
          The two strategies
        </h3>
        <div className="rounded-[var(--radius-panel)] border border-stone bg-paper p-3">
          <p className="text-sm font-medium text-ink">Model-based planner</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-ink-2">
            <li>Holds a map of the grid it trained in and searches it for a shortest route (breadth-first).</li>
            <li>Learns a wall only by bumping into it; replans after every move.</li>
            <li>Is told when the goal moves; is never told about a block or a new opening.</li>
          </ul>
        </div>
        <div className="rounded-[var(--radius-panel)] border border-stone bg-paper p-3">
          <p className="text-sm font-medium text-ink">Cached policy</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-ink-2">
            <li>Stores a value for each action in each cell, learned from experience (Q-learning, cost 1 per move).</li>
            <li>Acts on the stored values with occasional random moves (epsilon); updates them only as it moves.</li>
            <li>Has no map, so it cannot use an announcement.</li>
          </ul>
        </div>
      </section>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="pl-condition" className="text-sm font-medium text-ink">
            The change after training
          </label>
          <select
            id="pl-condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
            className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1 text-sm text-ink"
          >
            {(Object.keys(CONDITIONS) as Condition[]).map((c) => (
              <option key={c} value={c}>
                {CONDITIONS[c].label}
              </option>
            ))}
          </select>
        </div>
        <NumberField id="pl-training" label="Training episodes" value={training} onChange={setTraining} min={1} max={400} />
        <NumberField id="pl-epsilon" label="epsilon (cached)" value={epsilon} onChange={setEpsilon} min={0} max={0.9} step={0.05} />
        <NumberField id="pl-alpha" label="alpha (cached)" value={alpha} onChange={setAlpha} min={0.05} max={1} step={0.05} />
        <NumberField id="pl-seed" label="Seed" value={seed} onChange={(v) => setSeed(Math.max(0, Math.round(v)))} min={0} />
      </div>
      <LabNote>{spec.question}</LabNote>

      <div className="grid gap-4 sm:grid-cols-2">
        <Grid world={spec.before} paths={[]} title="Before the change (training)" />
        <Grid world={spec.after} paths={[]} title="After the change" oldGoal={condition === "revaluation" ? spec.before.goal : undefined} />
      </div>

      {result.error ? (
        <p role="alert" className="text-sm text-rust">
          {result.error}
        </p>
      ) : null}

      <details className="rounded-[var(--radius-panel)] border border-stone bg-paper p-3">
        <summary className="cursor-pointer text-sm text-ink">The information contract of this transfer test</summary>
        <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[14rem_1fr]">
          <dt className="font-medium text-ink">Observed</dt>
          <dd className="text-ink-2">{TRANSFER_CONTRACT.observed}</dd>
          <dt className="font-medium text-ink">Prediction target</dt>
          <dd className="text-ink-2">{TRANSFER_CONTRACT.target}</dd>
          <dt className="font-medium text-ink">History in training</dt>
          <dd className="text-ink-2">{TRANSFER_CONTRACT.historyInTraining}</dd>
          <dt className="font-medium text-ink">History at inference</dt>
          <dd className="text-ink-2">{TRANSFER_CONTRACT.historyAtInference}</dd>
          <dt className="font-medium text-ink">Person</dt>
          <dd className="text-ink-2">{TRANSFER_CONTRACT.person}</dd>
          <dt className="font-medium text-ink">Task</dt>
          <dd className="text-ink-2">{TRANSFER_CONTRACT.task}</dd>
          <dt className="font-medium text-ink">Later time periods</dt>
          <dd className="text-ink-2">{TRANSFER_CONTRACT.laterPeriods}</dd>
          <dt className="font-medium text-ink">Unavailable in real use</dt>
          <dd className="text-ink-2">{TRANSFER_CONTRACT.unavailableInRealUse}</dd>
          <dt className="font-medium text-ink">Simplest baseline</dt>
          <dd className="text-ink-2">{TRANSFER_CONTRACT.baseline}</dd>
          <dt className="font-medium text-ink">Claims not tested</dt>
          <dd className="text-ink-2">{TRANSFER_CONTRACT.untestedClaims}</dd>
        </dl>
      </details>

      {!predictionRecorded ? (
        <PredictionGate
          sessionId={sessionId}
          labId="planning-transfer"
          prompt="For the change you chose: what will each strategy do on its first decision, and on its first episode, after the change? Which single observation would tell them apart, and would watching more episodes help or hurt?"
        />
      ) : run ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Grid
              world={spec.after}
              title="First episode after the change: planner (solid) and cached policy (dashed, first 120 moves)"
              oldGoal={condition === "revaluation" ? spec.before.goal : undefined}
              paths={[
                { label: "planner", color: "var(--brass)", episode: run.planner[0]! },
                { label: "cached", color: "var(--slate)", episode: run.cached[0]! },
              ]}
            />
            <div className="overflow-x-auto">
              <table className="text-left text-sm">
                <caption className="pb-1 text-left text-xs text-ink-3">First episode after the change</caption>
                <thead className="text-xs uppercase tracking-wide text-ink-3">
                  <tr>
                    <th className="py-1 pr-3">Strategy</th>
                    <th className="py-1 pr-3">First move</th>
                    <th className="py-1 pr-3">Steps</th>
                    <th className="py-1 pr-3">Bumps</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Model-based planner", run.planner[0]!],
                      ["Cached policy", run.cached[0]!],
                    ] as const
                  ).map(([label, e]) => (
                    <tr key={label} className="border-t border-stone">
                      <td className="py-1 pr-3 text-ink">{label}</td>
                      <td className="py-1 pr-3 font-mono text-xs text-ink-2">{e.firstAction ?? "none"}</td>
                      <td className="py-1 pr-3 font-mono text-xs text-ink-2">
                        {e.steps}
                        {e.reachedGoal ? "" : " (stopped at the cap)"}
                      </td>
                      <td className="py-1 pr-3 font-mono text-xs text-ink-2">{e.bumps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-ink-3">
                Shortest route before the change {run.shortestBefore} steps; after it {run.shortestAfter} steps, on the changed map. The
                planner holds the map from before the change, and neither strategy is told what changed, except an announced new goal. An
                episode stops after {DEFAULT_SETTINGS.stepCap} moves.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="text-left text-sm">
              <caption className="pb-1 text-left text-xs text-ink-3">Every episode after the change</caption>
              <thead className="text-xs uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="py-1 pr-3">Episode</th>
                  <th className="py-1 pr-3">Planner moves</th>
                  <th className="py-1 pr-3">Planner bumps</th>
                  <th className="py-1 pr-3">Cached moves</th>
                  <th className="py-1 pr-3">Cached bumps</th>
                  <th className="py-1 pr-3">Mean gap, episodes 1 to k</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs text-ink-2">
                {run.planner.map((p, i) => {
                  const c = run.cached[i]!;
                  return (
                    <tr key={`episode-${i + 1}`} className="border-t border-stone">
                      <td className="py-1 pr-3 text-ink">{i + 1}</td>
                      <td className="py-1 pr-3">
                        {p.steps}
                        {p.reachedGoal ? "" : " (cap)"}
                      </td>
                      <td className="py-1 pr-3">{p.bumps}</td>
                      <td className="py-1 pr-3">
                        {c.steps}
                        {c.reachedGoal ? "" : " (cap)"}
                      </td>
                      <td className="py-1 pr-3">{c.bumps}</td>
                      <td className="py-1 pr-3">{run.gapByWindow[i]!.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Plot
            title="Steps per episode after the change"
            xLabel="episode after the change"
            yLabel="steps to the goal"
            series={[
              { label: "model-based planner", color: "var(--brass)", points: run.planner.map((e, i) => ({ x: i + 1, y: e.steps })) },
              { label: "cached policy", color: "var(--slate)", points: run.cached.map((e, i) => ({ x: i + 1, y: e.steps })) },
            ]}
          />
          <Plot
            title="The difference, averaged over the first k episodes after the change"
            xLabel="k (episodes averaged)"
            yLabel="mean extra steps for the cached policy"
            series={[{ label: "cached minus planner", color: "var(--rust)", points: run.gapByWindow.map((g, i) => ({ x: i + 1, y: g })) }]}
          />
          <LabNote>
            Read the first decision and the first episode before the averages: the cached policy relearns, so a longer window measures
            relearning as much as strategy. A condition in which both strategies behave alike tells you nothing about which one is in use.
          </LabNote>
        </>
      ) : null}
    </div>
  );
}
