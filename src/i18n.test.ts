import { describe, expect, it } from 'vitest';
import { isLanguagePreference, resolveLanguage } from './i18n';

describe('application language', () => {
  it('uses an explicit language override', () => {
    expect(resolveLanguage('ja', ['fr-FR'])).toBe('ja');
  });

  it('matches supported system language families and falls back to English', () => {
    expect(resolveLanguage('system', ['pt-PT'])).toBe('pt-BR');
    expect(resolveLanguage('system', ['zh-Hant'])).toBe('zh-CN');
    expect(resolveLanguage('system', ['sv-SE', 'fr-CA'])).toBe('fr');
    expect(resolveLanguage('system', ['sv-SE'])).toBe('en');
  });

  it('rejects unsupported saved overrides', () => {
    expect(isLanguagePreference('de')).toBe(true);
    expect(isLanguagePreference('pirate')).toBe(false);
  });
});
