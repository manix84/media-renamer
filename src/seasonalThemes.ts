import type { ThemePalette } from './theme';

export const STANDARD_PALETTES: ThemePalette[] = ['classic', 'ocean', 'forest', 'rose', 'amber'];

export function seasonalPalettesForDate(date: Date): ThemePalette[] {
  if (date.getMonth() === 9) return ['halloween'];
  if (date.getMonth() === 11) return ['christmas'];
  return [];
}

export function availablePalettes(date: Date, debugging: boolean): ThemePalette[] {
  return [...STANDARD_PALETTES, ...(debugging ? ['halloween', 'christmas'] as ThemePalette[] : seasonalPalettesForDate(date))];
}

export function isPaletteAvailable(palette: ThemePalette, date: Date, debugging: boolean): boolean {
  return availablePalettes(date, debugging).includes(palette);
}
