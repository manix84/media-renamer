import { describe, expect, it } from 'vitest';
import { matchReviewExplanation } from './matchPresentation';

describe('match review presentation', () => {
  it('explains why a TV suggestion was not automatically confirmed', () => {
    expect(matchReviewExplanation(.74, ['season and episode number', 'title 52%'], 80)).toBe(
      '74% confidence is below the 80% automatic confirmation threshold. Match evidence: season and episode number · title 52%.',
    );
  });

  it('describes manual review when no configurable threshold applies', () => {
    expect(matchReviewExplanation(.62, ['closest title', 'year differs'])).toBe(
      '62% confidence requires manual confirmation. Match evidence: closest title · year differs.',
    );
  });

  it('handles absent evidence without hiding the confidence', () => {
    expect(matchReviewExplanation(1.4, [], 80)).toBe('100% confidence requires manual confirmation. No strong matching evidence was found.');
  });
});
