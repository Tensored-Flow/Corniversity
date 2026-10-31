## Lesson notes (instructor only)

**Source mapping.** Sutton and Barto, *Reinforcement Learning: An Introduction*, second edition (RLbook2020.pdf; CC BY-NC-ND 2.0, imported for private study only). The record was verified on 2026-10-31. The sections used are:

- section 8.1, Models and Planning (p. 159);
- Example 8.2, Blocking Maze (p. 166);
- Example 8.3, Shortcut Maze (p. 167);
- the Dyna-Q+ bonus (p. 168);
- section 14.6, Habitual and Goal-directed Behavior (pp. 364 to 367), with the Figure 14.5 maze and the Adams and Dickinson (1981) devaluation experiment.

The text was extracted programmatically, and Greek letters did not always decode, so check any quoted equation against the page image. The other sources are these:

- **Tolman (1948).** Reference-only. The public-domain statement is the host's report of what APA officials told it. Cite the spatial orientation section. The words "short cut" and "shortcut" do not occur.
- **Daw et al. (2011).** The PMC author manuscript, CC BY 3.0, not importable because PMC forbids automated downloading. Use the Behavior section and Figures 1 and 2. The full model equations are in a supplement that was not opened.

**What to say plainly.** The book's blocking and shortcut examples compare Dyna-Q with Dyna-Q+, both model-based. The laboratory's known-map planner against Q-learning is this unit's construction, and learners must describe it that way in their reports.

**The laboratory.** Both strategies are deterministic in the seed. The planner breaks ties up, right, down, left and learns walls only by bumping. The cached policy uses $\alpha=0.5$ and $\varepsilon=0.1$ by default, costs 1 per move including bumps, applies no discounting, and starts every value at 0. Results stay hidden until the learner saves a prediction in the notebook.

**What to watch in tutorials.**

- Learners expect the shortcut condition to favour the planner. Ask why a planner that learns only walls would ever try the door.
- Learners report averaged gaps. Ask which episode carries the evidence, and why.
- Learners say "the agent wanted to reach the old goal" about the cached policy's first move to the right. Steer them back to values that have not been re-experienced.
- Learners vary alpha and read a left turn at $\alpha=0.1$ as planning. With 60 training episodes the cached policy's values at the start are then nearly tied and its first move is close to random: the diagnostic needs converged training.
- In the shortcut condition the cached policy sometimes finds the opening by exploration, and the never-visited cells beyond it, whose values start at 0, draw it in. That is optimism about untried values, not planning.
