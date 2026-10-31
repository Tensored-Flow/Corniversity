## Lesson notes (instructor only)

Source mapping (Neuromatch Deep Learning, W1D1 Tutorial 1: PyTorch, page opened 2026-10-30): Section 2.1 Creating Tensors contains the Reproducibility note and `set_seed`; Section 2.5 Datasets and Dataloaders loads CIFAR10 with `train=True` and `train=False`, wraps both in a `DataLoader` (batch size 64, shuffled) and seeds workers; Video 8 "Train and Test" sits inside Section 2.5 and the tutorial defers the split discussion to later days; Section 3.3 trains the toy network on the whole generated dataset with no split. The W2D1 Tutorial 1 sections "Overfitting on Test Dataset" and "Validation Dataset" are referenced by name in the lesson but belong to unit 6; do not cite them as this unit's reading.

Teaching intent: install the habit of asking "what produced this number?" before "how high is it?". The learner's mathematics background makes the risk/empirical-risk argument quick; spend the tutorial time on exercise 1, which is deliberately layered (five problems; most learners find two). The lab (`data-leakage-audit`, synthetic and labelled as such) should be run *before* the tutorial so the learner has felt a leak produce a real number; prediction-first: they write down expected accuracies before running.

Numbers used in the lesson are chosen to differ from the exercise answers (lesson: 92% base rate and 91% accuracy; exercise: 94% baseline and 97.4%), so the lesson does not leak the exercise.

Statement labels for the tutor: the unbiasedness argument is derived; the $\sqrt{2\ln p/n}$ extreme-value approximation is derived and approximate (the lab is the evidence); the Neuromatch section contents are source-backed; the leakage taxonomy is a Corniversity convention, not a source claim.

Staged misconception for a peer discussion, if the learner enables peers: a classmate may suggest "shuffle thoroughly, then split; randomness removes bias". The tutor resolves it in the same discussion via the same-machine next-week record, which is a temporal label leak no shuffle can remove.
