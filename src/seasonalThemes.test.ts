import { describe, expect, it } from 'vitest';
import { availablePaletteOrDefault, availablePalettes, seasonalPalettesForDate } from './seasonalThemes';

describe('seasonal themes', () => {
  it('offers Halloween only in October and Christmas only in December', () => {
    expect(seasonalPalettesForDate(new Date(2026, 9, 15))).toEqual(['halloween']);
    expect(seasonalPalettesForDate(new Date(2026, 11, 15))).toEqual(['christmas']);
    expect(seasonalPalettesForDate(new Date(2026, 6, 15))).toEqual([]);
  });

  it('keeps seasonal themes available while debugging', () => {
    expect(availablePalettes(new Date(2026, 6, 15), true)).toEqual(expect.arrayContaining(['halloween', 'christmas']));
  });

  it('falls back to Classic when a seasonal theme is unavailable', () => {
    expect(availablePaletteOrDefault('halloween', new Date(2026, 9, 1), false)).toBe('halloween');
    expect(availablePaletteOrDefault('halloween', new Date(2026, 9, 31), false)).toBe('halloween');
    expect(availablePaletteOrDefault('halloween', new Date(2026, 10, 1), false)).toBe('classic');
    expect(availablePaletteOrDefault('christmas', new Date(2026, 11, 31), false)).toBe('christmas');
    expect(availablePaletteOrDefault('christmas', new Date(2027, 0, 1), false)).toBe('classic');
    expect(availablePaletteOrDefault('christmas', new Date(2026, 6, 15), true)).toBe('christmas');
  });
});
