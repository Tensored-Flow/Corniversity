import { mulberry32, type Rng } from "./random";

/**
 * Two planning strategies on a small grid with an explicit state space, tested after the world
 * changes. The model-based planner searches its map of the grid (breadth-first, so its routes
 * are shortest on what it believes) and replans whenever its map or its goal changes; it learns
 * a wall only by bumping into it. The cached policy is tabular Q-learning: it stores action
 * values learned from experience (cost 1 per move) and acts on them, updating them only as it
 * moves. Everything is synthetic and deterministic in the seed.
 *
 * The teaching point is which observations tell the strategies apart. After a revaluation the
 * very first decision does; after a block, what happens on meeting it does; after a new shortcut
 * opens, nothing much does, because neither strategy looks for it. Averaging over many episodes
 * after the change dilutes whatever difference there is, because the cached policy relearns.
 */

export type Cell = readonly [number, number]; // [row, col]
export type Action = "up" | "right" | "down" | "left";
export const ACTIONS: readonly Action[] = ["up", "right", "down", "left"];
const DELTA: Record<Action, Cell> = { up: [-1, 0], right: [0, 1], down: [1, 0], left: [0, -1] };

export interface Layout {
  rows: number;
  cols: number;
  walls: ReadonlySet<string>;
}

export const key = (c: Cell) => `${c[0]},${c[1]}`;

function parse(lines: readonly string[]): { layout: Layout; marks: Record<string, Cell> } {
  const walls = new Set<string>();
  const marks: Record<string, Cell> = {};
  lines.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === "#") walls.add(key([r, c]));
      else if (ch !== ".") marks[ch] = [r, c];
    });
  });
  return { layout: { rows: lines.length, cols: lines[0]!.length, walls }, marks };
}

/**
 * Two routes from S to G: a short corridor on the right (column 7) and a long one on the left
 * (column 0). B marks the door that the block closes; O marks the opening that the shortcut adds.
 */
const BASE = ["........G", ".######..", ".######B#", ".######.#", "....S...#"];
const SHORTCUT_BEFORE = ["........G", ".######.#", ".#######.", ".######.#", "....S...#"];

export type Condition = "block" | "revaluation" | "shortcut";

export interface World {
  layout: Layout;
  start: Cell;
  goal: Cell;
}

export interface ConditionSpec {
  label: string;
  before: World;
  after: World;
  /** What the planner is told about the change, if anything (a revaluation is announced). */
  announced: "nothing" | "new goal";
  question: string;
}

function world(lines: readonly string[], overrides: Partial<{ goal: Cell; extraWalls: Cell[]; removeWalls: Cell[] }> = {}): World {
  const { layout, marks } = parse(lines.map((l) => l.replace("B", ".").replace("O", ".")));
  const walls = new Set(layout.walls);
  for (const w of overrides.extraWalls ?? []) walls.add(key(w));
  for (const w of overrides.removeWalls ?? []) walls.delete(key(w));
  return { layout: { ...layout, walls }, start: marks.S!, goal: overrides.goal ?? marks.G! };
}

/** The door the block closes, which is also the cell the shortcut opens. */
const DOOR: Cell = [2, 7];

export const CONDITIONS: Record<Condition, ConditionSpec> = {
  block: {
    label: "A door on the short route closes",
    before: world(BASE),
    after: world(BASE, { extraWalls: [DOOR] }),
    announced: "nothing",
    question: "What does each strategy do when it meets the closed door, and on the next episode?",
  },
  revaluation: {
    label: "The goal moves to the far corner (announced)",
    before: world(BASE),
    after: world(BASE, { goal: [0, 0] }),
    announced: "new goal",
    question: "Which way does each strategy turn on its very first decision after the announcement?",
  },
  shortcut: {
    label: "A shortcut opens on the right",
    before: world(SHORTCUT_BEFORE),
    after: world(SHORTCUT_BEFORE, { removeWalls: [DOOR] }),
    announced: "nothing",
    question: "Does either strategy use the shortcut, and does this condition tell them apart?",
  },
};

function inside(layout: Layout, c: Cell): boolean {
  return c[0] >= 0 && c[0] < layout.rows && c[1] >= 0 && c[1] < layout.cols;
}

/** One move in the real world: into a wall or off the grid the agent stays where it is. */
export function step(w: World, from: Cell, action: Action): { to: Cell; bumped: boolean } {
  const d = DELTA[action];
  const to: Cell = [from[0] + d[0], from[1] + d[1]];
  if (!inside(w.layout, to) || w.layout.walls.has(key(to))) return { to: from, bumped: true };
  return { to, bumped: false };
}

/** Breadth-first shortest path on a believed layout; ties broken in the fixed order up, right, down, left. */
export function shortestPath(layout: Layout, from: Cell, goal: Cell): Action[] | null {
  const startKey = key(from);
  const prev = new Map<string, { from: string; action: Action }>();
  const queue: Cell[] = [from];
  const seen = new Set([startKey]);
  while (queue.length) {
    const c = queue.shift()!;
    if (c[0] === goal[0] && c[1] === goal[1]) {
      const path: Action[] = [];
      let k = key(c);
      while (k !== startKey) {
        const p = prev.get(k)!;
        path.unshift(p.action);
        k = p.from;
      }
      return path;
    }
    for (const a of ACTIONS) {
      const d = DELTA[a];
      const n: Cell = [c[0] + d[0], c[1] + d[1]];
      const nk = key(n);
      if (!inside(layout, n) || layout.walls.has(nk) || seen.has(nk)) continue;
      seen.add(nk);
      prev.set(nk, { from: key(c), action: a });
      queue.push(n);
    }
  }
  return null;
}

export interface Episode {
  steps: number;
  reachedGoal: boolean;
  bumps: number;
  firstAction: Action | null;
  path: Cell[];
}

/** The information contract of the transfer test, shown before any number. */
export const TRANSFER_CONTRACT = {
  observed: "The moves of two synthetic agents on the grid, during training and after one change to the world.",
  target:
    "Each agent's behaviour after the change: its first move, and its moves and bumps in each episode; an episode stops at the step cap.",
  historyInTraining:
    "Training episodes in the world before the change: the cached policy learns its values from them, and the planner is given that world's map.",
  historyAtInference:
    "What each agent carries from training (the cached values; the planner's map) and its own experience since the change; in the revaluation condition the planner is also told the new goal.",
  person: "Not applicable: each agent is the same agent before and after the change.",
  task: "Changed: the world after the change differs from the training world by exactly one stated change.",
  laterPeriods: "Yes: every test episode comes after training.",
  unavailableInRealUse: "The planner's map is given, not learned; a real agent would have to build it.",
  baseline: "The shortest route after the change, and the other strategy.",
  untestedClaims: "Anything about people or animals, other environments, and mixtures of the two strategies.",
} as const;

export interface StrategySettings {
  /** Q-learning step size and exploration rate for the cached policy. */
  alpha: number;
  epsilon: number;
  trainingEpisodes: number;
  testEpisodes: number;
  /** Episodes stop here if the goal is not reached, and the cap is reported. */
  stepCap: number;
}

export const DEFAULT_SETTINGS: StrategySettings = { alpha: 0.5, epsilon: 0.1, trainingEpisodes: 60, testEpisodes: 12, stepCap: 300 };

export class PlanningLabError extends Error {}

function validate(settings: StrategySettings): void {
  if (!(settings.alpha > 0 && settings.alpha <= 1)) throw new PlanningLabError("alpha must lie in (0, 1].");
  if (!(settings.epsilon >= 0 && settings.epsilon < 1)) throw new PlanningLabError("epsilon must lie in [0, 1).");
  if (settings.trainingEpisodes < 1 || settings.trainingEpisodes > 400)
    throw new PlanningLabError("Training episodes must be between 1 and 400.");
  if (settings.testEpisodes < 1 || settings.testEpisodes > 60) throw new PlanningLabError("Test episodes must be between 1 and 60.");
  if (settings.stepCap < 10 || settings.stepCap > 2000) throw new PlanningLabError("The step cap must be between 10 and 2000.");
}

/** The model-based planner: knows the layout it was trained in, learns walls by bumping, replans every step. */
function runPlanner(w: World, believed: Set<string>, goal: Cell, cap: number): Episode {
  let at: Cell = w.start;
  const path: Cell[] = [at];
  let bumps = 0;
  let firstAction: Action | null = null;
  for (let t = 0; t < cap; t++) {
    if (at[0] === goal[0] && at[1] === goal[1]) return { steps: t, reachedGoal: true, bumps, firstAction, path };
    const plan = shortestPath({ ...w.layout, walls: believed }, at, goal);
    if (!plan || plan.length === 0) return { steps: t, reachedGoal: false, bumps, firstAction, path };
    const action = plan[0]!;
    if (firstAction === null) firstAction = action;
    const result = step(w, at, action);
    if (result.bumped) {
      bumps++;
      const d = DELTA[action];
      believed.add(key([at[0] + d[0], at[1] + d[1]]));
    }
    at = result.to;
    path.push(at);
  }
  return { steps: cap, reachedGoal: at[0] === goal[0] && at[1] === goal[1], bumps, firstAction, path };
}

type QTable = Map<string, Record<Action, number>>;

function q(table: QTable, c: Cell): Record<Action, number> {
  const k = key(c);
  let row = table.get(k);
  if (!row) {
    row = { up: 0, right: 0, down: 0, left: 0 };
    table.set(k, row);
  }
  return row;
}

function greedy(row: Record<Action, number>): Action {
  let best: Action = "up";
  for (const a of ACTIONS) if (row[a] > row[best]) best = a;
  return best;
}

/** The cached policy: epsilon-greedy on learned values, Q-learning with a cost of 1 per move. */
function runCached(w: World, table: QTable, rng: Rng, s: StrategySettings, learn: boolean): Episode {
  let at: Cell = w.start;
  const path: Cell[] = [at];
  let bumps = 0;
  let firstAction: Action | null = null;
  for (let t = 0; t < s.stepCap; t++) {
    if (at[0] === w.goal[0] && at[1] === w.goal[1]) return { steps: t, reachedGoal: true, bumps, firstAction, path };
    const row = q(table, at);
    const action = rng.next() < s.epsilon ? ACTIONS[Math.floor(rng.next() * 4)]! : greedy(row);
    if (firstAction === null) firstAction = action;
    const result = step(w, at, action);
    if (result.bumped) bumps++;
    const done = result.to[0] === w.goal[0] && result.to[1] === w.goal[1];
    if (learn) {
      const next = done ? 0 : Math.max(...ACTIONS.map((a) => q(table, result.to)[a]));
      row[action] += s.alpha * (-1 + next - row[action]);
    }
    at = result.to;
    path.push(at);
  }
  return { steps: s.stepCap, reachedGoal: false, bumps, firstAction, path };
}

export interface TransferRun {
  condition: Condition;
  shortestBefore: number;
  shortestAfter: number;
  /** The last training episode of each strategy, before the change. */
  lastTraining: { planner: Episode; cached: Episode };
  /** Episodes after the change, in order. */
  planner: Episode[];
  cached: Episode[];
  /** Mean (cached - planner) steps over the first k episodes after the change, for k = 1..K. */
  gapByWindow: number[];
}

export function runTransfer(condition: Condition, settings: StrategySettings = DEFAULT_SETTINGS, seed = 1): TransferRun {
  validate(settings);
  const spec = CONDITIONS[condition];
  const rng = mulberry32(seed);
  const table: QTable = new Map();
  let lastCached: Episode | null = null;
  for (let e = 0; e < settings.trainingEpisodes; e++) lastCached = runCached(spec.before, table, rng, settings, true);
  // The planner knows the layout it trained in; it is not told about a block or an opening.
  const believed = new Set(spec.before.layout.walls);
  const lastPlanner = runPlanner(spec.before, new Set(believed), spec.before.goal, settings.stepCap);
  const plannerGoal = spec.announced === "new goal" ? spec.after.goal : spec.before.goal;
  const planner: Episode[] = [];
  const cached: Episode[] = [];
  for (let e = 0; e < settings.testEpisodes; e++) {
    planner.push(runPlanner(spec.after, believed, plannerGoal, settings.stepCap));
    cached.push(runCached(spec.after, table, rng, settings, true));
  }
  const gapByWindow = planner.map((_, k) => {
    let sum = 0;
    for (let i = 0; i <= k; i++) sum += cached[i]!.steps - planner[i]!.steps;
    return sum / (k + 1);
  });
  return {
    condition,
    shortestBefore: shortestPath(spec.before.layout, spec.before.start, spec.before.goal)?.length ?? -1,
    shortestAfter: shortestPath(spec.after.layout, spec.after.start, spec.after.goal)?.length ?? -1,
    lastTraining: { planner: lastPlanner, cached: lastCached! },
    planner,
    cached,
    gapByWindow,
  };
}

/** The grid as text, for the page and for tests: # wall, S start, G goal. */
export function render(w: World): string[] {
  return Array.from({ length: w.layout.rows }, (_, r) =>
    Array.from({ length: w.layout.cols }, (_, c) => {
      if (r === w.start[0] && c === w.start[1]) return "S";
      if (r === w.goal[0] && c === w.goal[1]) return "G";
      return w.layout.walls.has(key([r, c])) ? "#" : ".";
    }).join(""),
  );
}
