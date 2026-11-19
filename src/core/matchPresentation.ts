export function matchReviewExplanation(confidence: number, reasons: string[], automaticThreshold?: number): string {
  const percentage = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const threshold = automaticThreshold === undefined ? undefined : Math.round(Math.max(0, Math.min(100, automaticThreshold)));
  const decision = threshold !== undefined && percentage < threshold
    ? `${percentage}% confidence is below the ${threshold}% automatic confirmation threshold.`
    : `${percentage}% confidence requires manual confirmation.`;
  const evidence = reasons.length ? ` Match evidence: ${reasons.join(' · ')}.` : ' No strong matching evidence was found.';
  return `${decision}${evidence}`;
}
