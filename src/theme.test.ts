import { describe, expect, it } from 'vitest';
import { isThemePreference, resolveTheme } from './theme';

describe('theme preference', () => {
  it('uses the system theme when automatic is selected', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('keeps explicit light and dark overrides', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('rejects invalid stored preferences', () => {
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('sepia')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});
