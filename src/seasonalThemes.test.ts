import { describe, expect, it } from 'vitest';
import { availablePalettes, seasonalPalettesForDate } from './seasonalThemes';

describe('seasonal themes', () => {
  it('offers Halloween only in October and Christmas only in December', () => {
    expect(seasonalPalettesForDate(new Date(2026, 9, 15))).toEqual(['halloween']);
    expect(seasonalPalettesForDate(new Date(2026, 11, 15))).toEqual(['christmas']);
    expect(seasonalPalettesForDate(new Date(2026, 6, 15))).toEqual([]);
  });

  it('keeps seasonal themes available while debugging', () => {
    expect(availablePalettes(new Date(2026, 6, 15), true)).toEqual(expect.arrayContaining(['halloween', 'christmas']));
  });
});
