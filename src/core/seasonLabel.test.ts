import { describe, expect, it } from 'vitest';
import { formatSeasonLabel } from './seasonLabel';

describe('season label formatter', () => {
  it('adds the season code to a genuinely named season', () => {
    expect(formatSeasonLabel('Motto', 1)).toBe('Motto (S01)');
  });

  it('does not repeat a generic season name', () => {
    expect(formatSeasonLabel('Season 1', 1)).toBe('Season 1');
    expect(formatSeasonLabel(undefined, 2)).toBe('Season 2');
  });

  it('uses a concise label for generic specials', () => {
    expect(formatSeasonLabel('Specials', 0)).toBe('Specials');
    expect(formatSeasonLabel('Webisodes', 0)).toBe('Webisodes (S00)');
  });
});
