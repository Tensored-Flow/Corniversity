# Original numerical investigations

Run the cumulative reference locally with `python3 project_reference.py > project-results.json`. Python 3 standard library only; no network, external datasets, paid providers or GPU. The script uses immutable partition IDs, training-only transforms, validation-selected checkpoints across three fixed seeds, and evaluates final/shift samples after selection. Read unit10 before interpreting results. Instructor reference solutions contain complete small programs for units3,4,5,7,8,9.

The recorded JSON is an author execution on 2026-11-12, not a population benchmark or learner outcome. It includes environment/code hash, all candidates, individual seed checkpoints, baselines and actual failures. Re-running a fixed reference confirms reproducibility, not a new independent test.
