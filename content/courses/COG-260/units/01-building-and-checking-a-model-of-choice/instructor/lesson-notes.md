## Lesson notes (instructor only)

**Source mapping.** Wilson and Collins (2019), eLife 8:e49547, CC BY 4.0. The record was verified on 2026-10-31 from the article page and the JATS XML.

- Read in full: the abstract, the introduction, the worked example, Box 1 (Models 1 to 5, Equations 1 to 7), and Rules 3 to 9 in heading order with Boxes 2 to 7. That covers Equations 8 to 11 and the prior table, and Appendix 2.
- Seen as headings only: Rules 1 and 10, Rule 2 outside Box 1, and Appendices 1 and 3 to 5.

Rule numbers follow heading order; the paper itself calls the rules "10 simple steps" and refers to validation as "Step 9".

The other sources are cited narrowly:

- **Dezfouli et al. (2019):** the Action prediction section only.
- **Eckstein et al. (2022):** the Summary of Part I only.
- **Huys et al. (2012):** the record's own note that its comparison is in sample, and that its choice probabilities are predictive "but not in the machine learning sense".

**Differences between the paper and its code.** Teach these as a reproducibility lesson, not as errors to mock.

- Box 1 gives $Q_0=0$, while the code and the laboratory use $0.5$.
- Equation 3 does not restrict the update to the chosen option, while the code does.
- Box 4 calls $\beta$ a temperature.
- Equation 10's printed form takes the log of a log-likelihood, while the code computes $k\ln T+2\,\mathrm{NLL}$.
- The paper writes Exp(10) without saying rate or mean, and the code's exprnd(10) uses the mean.

**The laboratory.** It implements Models 1 to 3 exactly as the lesson states them.

- **Bounds and the first trial:** $\beta\le20$; the trial-1 probability is $0.5$ for win-stay lose-shift and the softmax of the initial values for Rescorla-Wagner.
- **The gate:** results, including the learning curve, stay hidden until the learner saves a notebook entry tagged prediction. That entry records no evidence of understanding. One saved prediction opens the laboratory for the whole unit, so the activity asks for both cases' predictions before saving.
- **Measures and validation:** the laboratory reports model-independent measures for the participant: repeat rates after a reward and after none, also split by the previous arm, and the better-arm share in the first and last ten trials. *Validate the winning model by simulation* sets beside them the same measures from 20 sessions simulated with the lowest-BIC model's fitted parameters.
- **Design controls:** trials, reward probabilities and the participants' region can each be changed separately. Each case starts from a participant inside its own region.
- **Contracts first:** the selected split's contract is shown before the comparison is run.

**What the ambiguous case is about.** It is the participants' region, not the short session or the close arms, that makes the models hard to tell apart. More trials help slowly, and wider arms do not help: see the exercise 2 reference for the counts. Let learners find this with the design controls. The lesson deliberately describes the design without the result.

**What to watch in tutorials.**

- Learners often read the confusion matrix as $P(\text{generating}\mid\text{selected})$. Insist on the direction, and use Appendix 3 for the inversion.
- Learners read a difference between repeat rates after reward and after no reward as evidence of learning. For a biased responder that difference comes from which arm was chosen; the split by arm removes it.
- Learners expect the random-trials split to look better than the others. In this laboratory it often does not: at seed 42 it scores lower than the later-trials split. So the leak cannot be found in the numbers, and that is the moment to make them write the contract.
- Learners treat the ambiguous case as a bug. It is the unit's main result.
