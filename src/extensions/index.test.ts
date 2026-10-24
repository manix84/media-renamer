import { describe, expect, it } from 'vitest';
import { resolveExtensionBadges, resolveExtensionDestination, resolveExtensionMediaSettings, type ExtensionMediaContext, type InstalledExtension } from './index';

const animeExtension: InstalledExtension = {
  apiVersion: 1,
  id: 'media-renamer.anime',
  name: 'Anime libraries',
  version: '1.0.0',
  description: 'Routes Japanese animation into separate libraries.',
  settings: [
    { key: 'showBaseFolder', type: 'directory', label: 'Anime shows folder', description: 'Anime shows', pickerKind: 'TV' },
    { key: 'movieBaseFolder', type: 'directory', label: 'Anime movies folder', description: 'Anime movies', pickerKind: 'Movie' },
  ],
  match: { genreIds: [16] },
  anyOf: [{ originalLanguages: ['ja'] }, { originCountries: ['JP'] }],
  badges: [{ label: 'Anime' }],
  destinations: {
    show: { settingKey: 'showBaseFolder', label: 'Anime show' },
    movie: { settingKey: 'movieBaseFolder', label: 'Anime movie' },
  },
  mediaSettingsTabs: [
    { id: 'anime-shows', label: 'Anime Shows', mediaKind: 'show', note: 'Anime shows', baseFolderSettingKey: 'showBaseFolder', folderTemplateSettingKey: 'showFolderTemplate', fileTemplateSettingKey: 'episodeTemplate' },
    { id: 'anime-movies', label: 'Anime Movies', mediaKind: 'movie', note: 'Anime movies', baseFolderSettingKey: 'movieBaseFolder', folderTemplateSettingKey: 'movieFolderTemplate', fileTemplateSettingKey: 'movieTemplate' },
  ],
  source: 'development',
  canUninstall: false,
};
const extensions = [animeExtension];
const enabled = { [animeExtension.id]: { enabled: true, settings: { showBaseFolder: '/Anime Shows', movieBaseFolder: '/Anime Movies' } } };

describe('extension destination runtime', () => {
  it('routes Japanese animated shows and movies to their separate roots', () => {
    expect(resolveExtensionDestination({ kind: 'show', id: '1', name: 'Anime', genreIds: [16], originalLanguage: 'ja' }, enabled, extensions)?.baseFolder).toBe('/Anime Shows');
    expect(resolveExtensionDestination({ kind: 'movie', id: '2', name: 'Anime Movie', genreIds: [16], originCountries: ['JP'] }, enabled, extensions)?.baseFolder).toBe('/Anime Movies');
  });

  it('recognizes Million Arthur from normalized metadata', () => {
    const context: ExtensionMediaContext = { kind: 'show', id: '83451', name: 'Million Arthur', genreIds: [10759, 16, 10765], originalLanguage: 'ja', originCountries: ['JP'] };
    expect(resolveExtensionDestination(context, enabled, extensions)).toEqual({ baseFolder: '/Anime Shows', extensionId: animeExtension.id, label: 'Anime show' });
    expect(resolveExtensionBadges(context, enabled, extensions)).toEqual([{ extensionId: animeExtension.id, label: 'Anime' }]);
  });

  it('does not treat all animation or all Japanese media as anime', () => {
    expect(resolveExtensionDestination({ kind: 'movie', id: '3', name: 'Western animation', genreIds: [16], originalLanguage: 'en' }, enabled, extensions)).toBeUndefined();
    expect(resolveExtensionDestination({ kind: 'movie', id: '4', name: 'Japanese live action', genreIds: [18], originalLanguage: 'ja' }, enabled, extensions)).toBeUndefined();
  });

  it('does nothing while disabled or its destination is unset', () => {
    const context = { kind: 'show' as const, id: '1', name: 'Anime', genreIds: [16], originalLanguage: 'ja' };
    expect(resolveExtensionDestination(context, { [animeExtension.id]: { enabled: false, settings: { showBaseFolder: '/Anime' } } }, extensions)).toBeUndefined();
    expect(resolveExtensionDestination(context, { [animeExtension.id]: { enabled: true, settings: {} } }, extensions)).toBeUndefined();
    expect(resolveExtensionBadges(context, { [animeExtension.id]: { enabled: false, settings: {} } }, extensions)).toEqual([]);
    expect(resolveExtensionBadges(context, { [animeExtension.id]: { enabled: true, settings: {} } }, extensions)).toEqual([{ extensionId: animeExtension.id, label: 'Anime' }]);
  });

  it('returns only explicitly customized media settings so the host can inherit the rest', () => {
    const context: ExtensionMediaContext = { kind: 'show', id: '1', name: 'Anime', genreIds: [16], originalLanguage: 'ja' };
    expect(resolveExtensionMediaSettings(context, enabled, extensions)).toEqual({ extensionId: animeExtension.id, tabId: 'anime-shows', mediaKind: 'show', baseFolder: '/Anime Shows', folderTemplate: undefined, fileTemplate: undefined });
    const customized = { [animeExtension.id]: { enabled: true, settings: { showFolderTemplate: '{{show.name}}/{{seasonFolder}}', episodeTemplate: '{{show.name}} - {{episode.range}}' } } };
    expect(resolveExtensionMediaSettings(context, customized, extensions)).toMatchObject({ folderTemplate: '{{show.name}}/{{seasonFolder}}', fileTemplate: '{{show.name}} - {{episode.range}}' });
  });

  it('ignores incompatible extension API versions', () => {
    expect(resolveExtensionDestination({ kind: 'show', id: '1', name: 'Example', genreIds: [16], originalLanguage: 'ja' }, enabled, [{ ...animeExtension, apiVersion: 2 } as unknown as InstalledExtension])).toBeUndefined();
  });
});
