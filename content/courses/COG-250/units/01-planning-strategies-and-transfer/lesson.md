## The question

Behaviour can show whether an agent plans with a model of its world or acts on values cached from experience, but not through performance in a stable world. Once trained, both strategies reach the goal efficiently. They differ in how they respond when the world changes, and only some changes reveal the difference. This unit compares the two strategies on a small grid with an explicit state space, under three kinds of change. In each case it asks which observation tells them apart.

Sutton and Barto frame the distinction in chapter 8. Section 8.1 defines models of the environment, distinguishing distribution models from sample models, and defines planning; read both definitions before going on. In this unit a *model* is whatever lets an agent work out the result of a move before making it, and *planning* is using a model to choose moves. Section 14.6 connects this to psychology's distinction between habitual and goal-directed behaviour. A model-free agent stores action values or a policy. A model-based agent stores a model of state transitions and rewards and evaluates actions by consulting it. In their maze example (Figure 14.5), when the reward in a goal box changes, a model-free agent must experience the change again before its cached values reflect it.

## Two strategies

Both strategies live on the same grid of five rows and nine columns. `#` is a wall, `S` the start, `G` the goal, and `B` a door that one of the changes closes:

```
........G
.######..
.######B#
.######.#
....S...#
```

There are two routes from `S` to `G`: a short one up the right-hand corridor through the door, and a long one up the left-hand side and along the top. A move costs 1. A move into a wall or off the grid leaves the agent where it is and still costs 1; call it a *bump*.

**Model (model-based planner).** The planner holds a map, a set of cells it believes are walls, and a goal. At every step it computes a shortest path on its map by breadth-first search, with ties broken in the order up, right, down, left, and takes the first move. It updates the map in one way only: when a move bumps into a wall it did not know about, it adds that wall. It never learns that a believed wall has gone. When it is told the goal has moved, it plans to the new goal at once.

**Model (cached policy).** The cached policy is tabular Q-learning. It keeps a value $Q(s,a)$ for every cell $s$ and move $a$, all starting at 0, and learns from each move it makes:

$$Q(s,a)\leftarrow Q(s,a)+\alpha\big(-1+\max_{a'}Q(s',a')-Q(s,a)\big),$$

where $s'$ is the cell the move led to ($s'=s$ after a bump), and the maximum is taken to be 0 when $s'$ is the goal. There is no discounting. It chooses moves $\varepsilon$-greedily. With probability $1-\varepsilon$ it takes the move with the highest value, ties broken up, right, down, left. With probability $\varepsilon$ it takes one of the four moves uniformly at random. Its values change only along the moves it actually makes.

In the laboratory both strategies are first trained in the world before the change. The cached policy learns its values over 60 episodes by default. The planner is given the map of that world. Then the world changes and both are tested for 12 episodes. Everything is synthetic and reproducible from the seed. An episode stops after 300 moves, and the laboratory marks any episode that stopped there.

## Three changes

- **Block.** The door closes. Neither strategy is told.
- **Revaluation.** The goal moves to the top-left corner, and the planner is told. This is the grid's version of outcome devaluation: section 14.6 describes the outcome-devaluation experiment of Adams and Dickinson (1981), worth reading for how the outcome's value is changed and what behaviour is then measured.
- **Shortcut.** The agents are trained in a variant of the grid with the door closed, so the right-hand corridor is a dead end. The variant differs in two other cells: (1,8) is a wall, and (2,8), beside the door, is open but can be reached only through the door. Then the door opens. Neither strategy is told.

Before running the laboratory, write down for each change what you expect each strategy to do on its first decision after the change, on the first episode, and on later episodes. The laboratory keeps its results hidden until that prediction is saved in your notebook.

## What each change can show

**Revaluation: the first decision.** The planner, told the new goal, turns towards it on its very first move. The cached policy's values still point to the old goal, and it can learn the new values only by experiencing them, one move at a time. The diagnostic observation is the first move after the announcement, before any new experience. With $\varepsilon>0$ a single first move is a noisy observation, because the cached policy sometimes explores. How noisy is a question in exercise 1. The diagnostic also assumes that the cached policy's training converged: with a small $\alpha$ or few training episodes its values at the start can be nearly tied, its first move is then close to random, and a turn towards the new goal is no evidence of planning.

**Block: what happens on meeting the change.** The planner walks to the door, bumps into it, adds the wall to its map and replans from where it stands; what it does on the next episode follows from the corrected map. The cached policy keeps choosing the blocked move until repeated bumps have lowered that move's value below the alternatives. Even then, the values of the cells leading to the door still favour the old route. The error spreads back along the route only as the agent revisits those cells. The diagnostic observations are the bumps on the first encounter and the route taken on the next episode.

**Shortcut: little, and only by accident.** The planner never takes the shortcut: its map says the door is a wall, and it learns walls, never openings. The cached policy can stumble through the opening by random exploration, and once it does, the cells it has never visited still have their starting values of 0, higher than any value it has learned, so its greedy moves are drawn into them and it can wander there for many moves. Within a few episodes it seldom reaches the goal through the opening and does not settle on the shortest route. This change therefore separates the strategies only weakly and noisily, and what difference there is comes from exploration and from the optimism of untried values, not from planning. Sutton and Barto's shortcut maze (Example 8.3) makes a related point about another pair of agents: Dyna-Q, which learns a model and plans with it, never switches to the shortcut, and Dyna-Q+, which adds an exploration bonus for transitions not tried for a long time, is the book's remedy.

## Averages dilute the evidence

The laboratory reports the gap between the strategies, the cached policy's steps minus the planner's, averaged over the first $k$ test episodes for each $k$. Because the cached policy relearns, its excess shrinks as the episodes pass. A summary averaged over many episodes after the change can make the strategies look closer than the first episode showed them to be. Report the observation that discriminates, together with its averaging window, and say why you chose it.

## What the sources compare, and what this laboratory compares

Sutton and Barto's blocking maze (Example 8.2) and shortcut maze (Example 8.3) compare Dyna-Q with Dyna-Q+. Both agents learn a model and plan; neither is a known-map planner set against a model-free learner. The book's figures plot cumulative reward over time steps, not the first decision after a change. Among the chapter's mazes, the non-planning agent (one-step tabular Q-learning, with no planning steps) appears only in the Dyna maze of Example 8.1. The laboratory's pairing of a known-map planner with a cached policy is this unit's own construction. It takes its changes from those examples and its contrast from section 14.6, and it should be described that way.

Tolman (1948) is the classical source for *cognitive maps*. The words "short cut" and "shortcut" do not occur in the paper. The relevant passage is its section on spatial orientation:

- Lashley's rats, which ran directly across the top of the maze to the goal box;
- the sun-burst test of Ritchie and Kalish, in which the trained route was blocked and radiating paths were added.

The paper is reference-only in this library, so read it on the host's site. Its closing section applies the idea to human social life in the language of 1948; read it with that context.

Daw et al. (2011) show how the contrast is measured in people, with the two-step task:

- Each first-stage choice usually leads to one second-stage state (70% of the time) and rarely to the other.
- After a rare transition that is then rewarded, a learner that caches the value of its first-stage choice tends to repeat that choice, because it was followed by reward.
- A learner that knows the transition structure credits the reward to the second-stage state, which the other first-stage choice reaches more reliably, so it tends to switch. Both predictions follow from the structure of the task.

The stay probabilities split by reward and transition type are a model-independent measure, and the paper's Figure 2 shows the two strategies' predictions beside the data. The design builds the discriminating observation into every trial; it does not wait for a single change. Unit 2 works through it.

## Telling a result from the strategy that produced it

A result is behaviour: steps, bumps, a first move, a stay probability. A strategy is a hypothesis about how the behaviour was produced. Keep the two apart in writing:

- "the agent took more moves on the first episode after the block than before it" is a result;
- "the agent replanned" is an interpretation;
- "the agent replanned because it holds a map" is a claim about mechanism, which needs an observation that the alternative strategy could not have produced.

In this laboratory the agents' strategies are known, because they were written down. In an experiment with people or animals they are not, and the same observations have to be designed to separate them.
