/**
 * The prediction stage of a laboratory. Results are shown once a prediction has been saved, and
 * stay shown across reloads and sessions because predictions are notebook entries. A learner may
 * deliberately predict again (to test a changed design, say): the results are then hidden until
 * a prediction newer than that request is saved. Earlier predictions are never deleted; each one
 * stays in the notebook with its date, so every attempt remains a distinct record.
 */
export function predictionRevealed(predictionTimes: readonly Date[], predictAgainTimes: readonly Date[]): boolean {
  if (predictionTimes.length === 0) return false;
  const latestPrediction = Math.max(...predictionTimes.map((d) => d.getTime()));
  const latestReset = predictAgainTimes.length ? Math.max(...predictAgainTimes.map((d) => d.getTime())) : Number.NEGATIVE_INFINITY;
  return latestPrediction > latestReset;
}
