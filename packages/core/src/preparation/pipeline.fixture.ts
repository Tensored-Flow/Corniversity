import type { UnitDraft } from "./pipeline";

/** Deliberately authored test data, not output from a model or a learner-facing course. */
export function preparationDraft(passageId = "passage-1", locatorId = "source-location-1"): UnitDraft {
  return {
    lessonMarkdown: `# What a decoder's score can establish

A neural decoder estimates a measured target from a pattern of population activity. The scientific question comes first: are we predicting another trial from this recording session, a new session, or an unseen animal? These are distinct questions even when the same regression function is used. A numerical score without a statement of the target population cannot distinguish them.

Let x denote the recorded activity and y the target. Training chooses parameters using a designated training set. A validation set informs choices such as model capacity and stopping time. A final test set is reserved until these choices are fixed. Data used repeatedly to choose models is validation data regardless of whether its filename says test. Changing the split after observing an inconvenient result changes the analysis and must be disclosed.

The squared loss averages squared prediction errors. It is nonnegative, gives large errors disproportionate weight, and has the units of the target squared. Reporting its square root restores the target units. A low loss can arise because the task is easy or because information from the target accidentally entered the inputs. Neither possibility is resolved by adding more layers. Always compare against a baseline that uses only information genuinely available at prediction time.

Consider a recording in which every stimulus is repeated many times. Randomly holding out individual trials can test interpolation to new trials of familiar stimuli. Holding out one entire stimulus asks whether the learned relationship extends to a condition absent from fitting. Holding out an animal instead targets another form of generalisation. No single split answers every question. A valid report states what is shared and what is separated between training and evaluation.

Preprocessing is part of the fitted model. Means, scales, feature selection and imputation parameters must be learned from training observations alone. Applying the resulting transformation to a test observation is legitimate; estimating the transformation from the entire dataset is not the same procedure. The distinction matters especially when labels or missingness influence feature construction. Keep preprocessing inside each training fold when cross-validation is used.

Capacity influences which relationships a decoder can express. More flexible models may fit signal that a simpler model misses, but they may also fit accidental details of the sample. This trade-off motivates validation; it does not imply that a particular network size is universally optimal. Report the search procedure and comparison budget. If many variants are tried, the final untouched evaluation becomes more important, not less.

Uncertainty is also tied to the sampling design. Trials from the same session may share noise, drift or preparation conditions. Treating them as independent animals would exaggerate the amount of evidence. When possible, evaluate across the independent units relevant to deployment and show variation across them. A single average can conceal failure on a subgroup or a stimulus range that matters scientifically.

An accurate decoder establishes a predictive association under its stated information conditions. It does not by itself establish a causal mechanism, identify how the brain computes, or show that the fitted parameters are biological quantities. Several models can make similar predictions. Interventions and competing predictions would be needed for stronger mechanistic claims. This limitation is a useful conclusion rather than a failure of the analysis.

Before running a decoder, write the target, available inputs, held-out unit, baseline and comparison metric. After running it, inspect residuals and failure cases as well as the aggregate result. Keep the original plan with the report and label exploratory changes. The problems below ask you to transfer these distinctions to different recording designs rather than memorise a preferred train–test ratio.`,
    objectives: ["Design and interpret a held-out evaluation of a neural decoder."],
    sourceLocatorIds: [locatorId],
    sourcePassageIds: [passageId],
    workedExamples: [
      {
        title: "A baseline that exposes a misleading score",
        objectiveIndexes: [0],
        reasoningMarkdown:
          "Suppose a reserved evaluation set has targets 2 and 4. A constant baseline fitted on the training set predicts 3 for both observations. Its squared errors are 1 and 1, so its mean squared error is 1. A decoder predicts 2 and 5, giving squared errors 0 and 1 and therefore mean squared error 0.5. On these two observations the decoder improves this metric. That arithmetic alone does not tell us whether the difference persists in future sessions: the evaluation sample is tiny, and its sampling unit must still be described. If either observation was used to select this decoder, call the set validation data and reserve fresh observations for the final comparison. The calculation is original; the supplied reading supports the evaluation distinction.",
      },
    ],
    exercises: [
      {
        title: "Evaluate a fixed prediction rule",
        kind: "calculation",
        stage: "independent",
        objectiveIndexes: [0],
        promptMarkdown:
          "A fixed decoder predicts 1 and 5 for targets 3 and 4 on two untouched trials. Compute its mean squared error and state one limitation of this estimate.",
        hintLadder: ["Subtract each target from its prediction before squaring.", "Ask which population the two trials could represent."],
        criteria: [
          { criterion: "Computes the loss correctly with squared units.", weight: 0.5 },
          { criterion: "Distinguishes the sample score from generalisation evidence.", weight: 0.5 },
        ],
        referenceSolution:
          "The residuals are negative two and positive one; averaging their squares gives 2.5 in squared target units. This two-trial estimate is too limited to establish reliable performance across sessions or animals. An acceptable answer specifies the actual sampling design and avoids extrapolating beyond it.",
      },
      {
        title: "Move to another animal",
        kind: "explanation",
        stage: "unfamiliar",
        objectiveIndexes: [0],
        promptMarkdown:
          "Recordings contain repeated trials from ten animals. Deployment is on an eleventh animal. Propose a split and explain why a random trial split answers a different question.",
        hintLadder: [
          "Identify the unit that will be new when the decoder is deployed.",
          "Keep every trial from that unit on the same side of a split.",
        ],
        criteria: [
          { criterion: "Holds animals apart and fits preprocessing within training.", weight: 0.6 },
          { criterion: "Limits the interpretation of random-trial evaluation.", weight: 0.4 },
        ],
        referenceSolution:
          "Hold out complete animals, selecting model settings using only the remaining animals and their internal validation folds. Fit preprocessing there too. Trial-level splitting leaves animal-specific signals on both sides; it can evaluate another trial of a familiar animal but cannot alone support transfer to a different animal.",
      },
      {
        title: "Diagnose a perfect score",
        kind: "conceptual",
        stage: "counterexample",
        objectiveIndexes: [0],
        promptMarkdown:
          "A feature table accidentally contains the future target in its last column. A model scores perfectly on randomly held-out rows. Explain what this does and does not show, then repair the evaluation.",
        hintLadder: [
          "List the information actually available before the prediction is made.",
          "A new row is not enough if its inputs disclose its own answer.",
        ],
        criteria: [
          { criterion: "Identifies unavailable target leakage.", weight: 0.5 },
          { criterion: "Rebuilds inputs and evaluates without reusing the compromised test for choices.", weight: 0.5 },
        ],
        referenceSolution:
          "The last column supplies information unavailable at deployment. Perfect performance therefore measures recovery of an exposed answer, not usable prediction. Remove the offending feature, audit the pipeline for related leakage, repeat selection with valid information, and reserve fresh data for the final assessment after all repairs are chosen.",
      },
    ],
    misconceptions: [
      {
        claim: "A random held-out row always tests deployment.",
        correction: "The held-out unit and available information must match the intended deployment question.",
      },
    ],
  };
}
