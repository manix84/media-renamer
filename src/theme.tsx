import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { availablePaletteOrDefault, isPaletteAvailable } from './seasonalThemes';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;
export type ThemePalette = 'classic' | 'ocean' | 'forest' | 'rose' | 'amber' | 'valentines' | 'pride' | 'bonfire' | 'new-year' | 'spring' | 'summer' | 'autumn' | 'winter' | 'halloween' | 'christmas';

const STORAGE_KEY = 'media-renamer-theme';
const PALETTE_STORAGE_KEY = 'media-renamer-palette';
const ThemeContext = createContext<{
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  palette: ThemePalette;
  setPreference: (preference: ThemePreference) => void;
  setPalette: (palette: ThemePalette, developerMode?: boolean) => void;
} | undefined>(undefined);

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function isThemePalette(value: unknown): value is ThemePalette {
  return value === 'classic' || value === 'ocean' || value === 'forest' || value === 'rose' || value === 'amber' || value === 'valentines' || value === 'pride' || value === 'bonfire' || value === 'new-year' || value === 'spring' || value === 'summer' || value === 'autumn' || value === 'winter' || value === 'halloween' || value === 'christmas';
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
    const palette = isThemePalette(stored) ? stored : 'classic';
    return availablePaletteOrDefault(palette, new Date(), false);
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
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const resolvedTheme = resolveTheme(preference, systemDark);

  useEffect(() => {
    let active = true;
    if (!window.mediaRenamer?.loadPreferences) {
      setPreferencesHydrated(true);
      return;
    }
    void window.mediaRenamer.loadPreferences().then((saved) => {
      if (!active) return;
      if (isThemePreference(saved.themePreference)) setPreferenceState(saved.themePreference);
      if (isThemePalette(saved.themePalette)) setPaletteState(availablePaletteOrDefault(saved.themePalette, new Date(), saved.developerMode === true));
    }).catch(() => undefined).finally(() => { if (active) setPreferencesHydrated(true); });
    return () => { active = false; };
  }, []);

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
        setPaletteState(availablePaletteOrDefault(next, new Date(), false));
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

  useEffect(() => {
    if (!preferencesHydrated || !window.mediaRenamer?.savePreferences) return;
    void window.mediaRenamer.savePreferences({ themePreference: preference, themePalette: palette }).catch(() => undefined);
  }, [palette, preference, preferencesHydrated]);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The preference still applies for this session if storage is unavailable.
    }
  }

  function setPalette(next: ThemePalette, developerMode = false) {
    if (!isPaletteAvailable(next, new Date(), developerMode)) return;
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
