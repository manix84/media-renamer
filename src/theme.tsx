import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isPaletteAvailable } from './seasonalThemes';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;
export type ThemePalette = 'classic' | 'ocean' | 'forest' | 'rose' | 'amber' | 'halloween' | 'christmas';

const STORAGE_KEY = 'media-renamer-theme';
const PALETTE_STORAGE_KEY = 'media-renamer-palette';
const ThemeContext = createContext<{
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  palette: ThemePalette;
  setPreference: (preference: ThemePreference) => void;
  setPalette: (palette: ThemePalette) => void;
} | undefined>(undefined);

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function isThemePalette(value: unknown): value is ThemePalette {
  return value === 'classic' || value === 'ocean' || value === 'forest' || value === 'rose' || value === 'amber' || value === 'halloween' || value === 'christmas';
}

export function resolveTheme(preference: ThemePreference, systemIsDark: boolean): ResolvedTheme {
  return preference === 'system' ? (systemIsDark ? 'dark' : 'light') : preference;
}

function storedPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function storedPalette(): ThemePalette {
  try {
    const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    const palette = stored === 'winter' ? 'christmas' : isThemePalette(stored) ? stored : 'classic';
    return isPaletteAvailable(palette, new Date(), import.meta.env.DEV) ? palette : 'classic';
  } catch {
    return 'classic';
  }
}

function systemIsDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(storedPreference);
  const [palette, setPaletteState] = useState<ThemePalette>(storedPalette);
  const [systemDark, setSystemDark] = useState(systemIsDark);
  const resolvedTheme = resolveTheme(preference, systemDark);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const update = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setPreferenceState(isThemePreference(event.newValue) ? event.newValue : 'system');
      if (event.key === PALETTE_STORAGE_KEY) {
        const next = isThemePalette(event.newValue) ? event.newValue : 'classic';
        setPaletteState(isPaletteAvailable(next, new Date(), import.meta.env.DEV) ? next : 'classic');
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.palette = palette;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [palette, resolvedTheme]);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The preference still applies for this session if storage is unavailable.
    }
  }

  function setPalette(next: ThemePalette) {
    if (!isPaletteAvailable(next, new Date(), import.meta.env.DEV)) return;
    setPaletteState(next);
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, next);
    } catch {
      // The palette still applies for this session if storage is unavailable.
    }
  }

  return <ThemeContext.Provider value={{ preference, resolvedTheme, palette, setPreference, setPalette }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside ThemeProvider.');
  return theme;
}
