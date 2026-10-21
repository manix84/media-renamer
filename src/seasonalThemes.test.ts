import { describe, expect, it } from 'vitest';
import { availablePaletteOrDefault, availablePalettes, seasonalPalettesForDate } from './seasonalThemes';

describe('seasonal themes', () => {
  it('offers Halloween only in October and Christmas only in December', () => {
    expect(seasonalPalettesForDate(new Date(2026, 9, 15))).toEqual(['halloween', 'autumn']);
    expect(seasonalPalettesForDate(new Date(2026, 11, 15))).toEqual(['christmas', 'winter']);
    expect(seasonalPalettesForDate(new Date(2026, 6, 15))).toEqual(['summer']);
  });

  it('prioritises short events before their broader season', () => {
    expect(seasonalPalettesForDate(new Date(2026, 1, 14))).toEqual(['valentines', 'winter']);
    expect(seasonalPalettesForDate(new Date(2026, 5, 15))).toEqual(['pride', 'summer']);
    expect(seasonalPalettesForDate(new Date(2026, 10, 5))).toEqual(['bonfire', 'autumn']);
    expect(seasonalPalettesForDate(new Date(2026, 11, 31))).toEqual(['new-year', 'christmas', 'winter']);
    expect(seasonalPalettesForDate(new Date(2027, 0, 2))).toEqual(['new-year', 'winter']);
    expect(seasonalPalettesForDate(new Date(2027, 0, 3))).toEqual(['winter']);
  });

  it('keeps seasonal themes available while debugging', () => {
    expect(availablePalettes(new Date(2026, 6, 15), true)).toEqual(expect.arrayContaining(['valentines', 'pride', 'bonfire', 'new-year', 'spring', 'summer', 'autumn', 'winter', 'halloween', 'christmas']));
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
