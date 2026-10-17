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
    const preferences = { tvBaseFolder: '/Media/TV', showFolderTemplate: '{{show.name}}/{{seasonFolder}}', matchConfidenceThreshold: 76, clearSourceJunk: true, removeEmptySourceParents: true, autoClearCompletedBatch: true, completionChime: true, completionReport: false, createExternalRenameLog: true, renameLogFolder: '/Media/Logs', fileViewMode: 'compact' as const, languagePreference: 'fr' as const, themePreference: 'dark' as const, themePalette: 'ocean' as const, titleMatching: false };
    await writePreferences(filePath, preferences);
    await expect(readPreferences(filePath)).resolves.toEqual(preferences);
  });

  it('ignores unknown and invalid values', () => {
    expect(normalizePreferences({ tvBaseFolder: '/Media/TV', unknown: 'value', matchConfidenceThreshold: 12, removeEmptySourceParents: 'yes' })).toEqual({ tvBaseFolder: '/Media/TV' });
  });

  it('recovers from a malformed settings file', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-renamer-preferences-'));
    temporaryDirectories.push(root);
    const filePath = path.join(root, 'preferences.json');
    await fs.promises.writeFile(filePath, '{broken');
    await expect(readPreferences(filePath)).resolves.toEqual({});
  });
});
