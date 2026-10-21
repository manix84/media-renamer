import type { ThemePalette } from './theme';

export const STANDARD_PALETTES: ThemePalette[] = ['classic', 'ocean', 'forest', 'rose', 'amber'];
export const SEASONAL_PALETTES: ThemePalette[] = ['valentines', 'pride', 'bonfire', 'new-year', 'spring', 'summer', 'autumn', 'winter', 'halloween', 'christmas'];

export function seasonalPalettesForDate(date: Date): ThemePalette[] {
  const month = date.getMonth();
  const day = date.getDate();
  const palettes: ThemePalette[] = [];

  if ((month === 11 && day === 31) || (month === 0 && day <= 2)) palettes.push('new-year');
  if (month === 1 && day <= 14) palettes.push('valentines');
  if (month === 5) palettes.push('pride');
  if (month === 9) palettes.push('halloween');
  if (month === 10 && day <= 5) palettes.push('bonfire');
  if (month === 11) palettes.push('christmas');

  if (month >= 2 && month <= 4) palettes.push('spring');
  else if (month >= 5 && month <= 7) palettes.push('summer');
  else if (month >= 8 && month <= 10) palettes.push('autumn');
  else palettes.push('winter');

  return palettes;
}

export function availablePalettes(date: Date, debugging: boolean): ThemePalette[] {
  return [...STANDARD_PALETTES, ...(debugging ? SEASONAL_PALETTES : seasonalPalettesForDate(date))];
}

export function isPaletteAvailable(palette: ThemePalette, date: Date, debugging: boolean): boolean {
  return availablePalettes(date, debugging).includes(palette);
}

export function availablePaletteOrDefault(palette: ThemePalette, date: Date, developerMode: boolean): ThemePalette {
  return isPaletteAvailable(palette, date, developerMode) ? palette : 'classic';
}
