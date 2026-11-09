/**
 * The ten questions every predictive exercise and laboratory result answers before it reports a
 * number. A split's contract says what the held-out data test and, as plainly, what they do not.
 */
export interface InformationContract {
  observed: string;
  target: string;
  historyInTraining: string;
  historyAtInference: string;
  person: "familiar" | "unseen" | "not_applicable";
  task: "familiar" | "unseen";
  laterPeriods: boolean;
  unavailableInRealUse: string;
  baseline: string;
  untestedClaims: string;
}
