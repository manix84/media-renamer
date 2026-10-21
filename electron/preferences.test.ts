import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { normalizePreferences, readPreferences, writePreferences } from './preferences';

const temporaryDirectories: string[] = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => fs.promises.rm(directory, { recursive: true, force: true }))));

describe('persistent preferences', () => {
  it('round-trips folders, templates, and preference controls', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-renamer-preferences-'));
    temporaryDirectories.push(root);
    const filePath = path.join(root, 'preferences.json');
    const preferences = { tvBaseFolder: '/Media/TV', showFolderTemplate: '{{show.name}}/{{seasonFolder}}', releaseAliasText: 'videoCodec = AVC => H.264', savedLibraryRoots: [{ id: 'shows:/Media/TV', kind: 'shows' as const, name: 'TV', path: '/Media/TV', updatedAt: 3456 }], savedBatchQueues: [{ id: 'queue-1', name: 'Weekly imports', mediaType: 'shows' as const, paths: ['/Downloads/a.mkv'], updatedAt: 4567 }], savedMatchDecisions: [{ showId: 'tvdb:11', filenameKey: 'episode 03', episodeIds: ['episode-3'], updatedAt: 1234 }], showRules: [{ showId: 'tvdb:11', titleMatching: false, confidenceThreshold: 91, updatedAt: 2345 }], matchConfidenceThreshold: 76, clearSourceJunk: true, removeEmptySourceParents: true, autoClearCompletedBatch: true, completionChime: true, completionReport: false, completionReportAutoClose: false, createExternalRenameLog: true, developerMode: true, exportNfo: true, exportPlexArtwork: true, renameLogFolder: '/Media/Logs', fileViewMode: 'compact' as const, languagePreference: 'fr' as const, themePreference: 'dark' as const, themePalette: 'ocean' as const, titleMatching: false };
    await writePreferences(filePath, preferences);
    await expect(readPreferences(filePath)).resolves.toEqual(preferences);
  });

  it('ignores unknown and invalid values', () => {
    expect(normalizePreferences({ tvBaseFolder: '/Media/TV', unknown: 'value', matchConfidenceThreshold: 12, removeEmptySourceParents: 'yes', savedMatchDecisions: [{ showId: '', filenameKey: '03', episodeIds: [], updatedAt: 'yesterday' }] })).toEqual({ tvBaseFolder: '/Media/TV', savedMatchDecisions: [] });
  });

  it('keeps metadata exports disabled unless explicitly enabled', () => {
    const preferences = normalizePreferences({});
    expect(preferences.exportNfo).toBeUndefined();
    expect(preferences.exportPlexArtwork).toBeUndefined();
  });

  it('recovers from a malformed settings file', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-renamer-preferences-'));
    temporaryDirectories.push(root);
    const filePath = path.join(root, 'preferences.json');
    await fs.promises.writeFile(filePath, '{broken');
    await expect(readPreferences(filePath)).resolves.toEqual({});
  });
});
