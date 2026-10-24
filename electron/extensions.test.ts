import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverExtensions, installExtension, normalizeExtensionManifest, uninstallExtension } from './extensions';

const temporaryDirectories: string[] = [];
const validManifest = {
  apiVersion: 1,
  id: 'example.router',
  name: 'Example router',
  version: '1.0.0',
  description: 'Routes matching media.',
  settings: [{ key: 'showFolder', type: 'directory', label: 'Show folder', description: 'Destination', pickerKind: 'TV' }],
  match: { genreIds: [16] },
  badges: [{ label: 'Example' }],
  destinations: { show: { settingKey: 'showFolder', label: 'Example show' } },
};

async function temporaryDirectory(): Promise<string> {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-renamer-extension-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.promises.rm(directory, { recursive: true, force: true })));
});

describe('extension packages', () => {
  it('normalizes supported declarative manifests', () => {
    expect(normalizeExtensionManifest(validManifest, 'installed')).toMatchObject({ id: 'example.router', source: 'installed', canUninstall: true });
  });

  it('rejects unsupported APIs and unknown destination settings', () => {
    expect(() => normalizeExtensionManifest({ ...validManifest, apiVersion: 2 }, 'installed')).toThrow('unsupported API');
    expect(() => normalizeExtensionManifest({ ...validManifest, destinations: { show: { settingKey: 'missing', label: 'Missing' } } }, 'installed')).toThrow('unknown setting');
    expect(() => normalizeExtensionManifest({ ...validManifest, mediaSettingsTabs: [{ id: 'example', label: 'Example', mediaKind: 'show', note: 'Example', baseFolderSettingKey: 'missing', folderTemplateSettingKey: 'folderTemplate', fileTemplateSettingKey: 'fileTemplate' }] }, 'installed')).toThrow('unknown directory setting');
  });

  it('accepts host-rendered media settings tabs', () => {
    const manifest = normalizeExtensionManifest({ ...validManifest, mediaSettingsTabs: [{ id: 'example-shows', label: 'Example Shows', mediaKind: 'show', note: 'Used in Shows.', baseFolderSettingKey: 'showFolder', folderTemplateSettingKey: 'showFolderTemplate', fileTemplateSettingKey: 'episodeTemplate' }] }, 'installed');
    expect(manifest.mediaSettingsTabs?.[0]).toMatchObject({ id: 'example-shows', mediaKind: 'show', baseFolderSettingKey: 'showFolder' });
  });

  it('installs, discovers, and uninstalls a package', async () => {
    const source = await temporaryDirectory();
    const installed = await temporaryDirectory();
    await fs.promises.writeFile(path.join(source, 'media-renamer-extension.json'), JSON.stringify(validManifest));
    expect(await installExtension(source, installed)).toMatchObject({ id: 'example.router', source: 'installed' });
    expect(await discoverExtensions([{ directory: installed, source: 'installed' }])).toHaveLength(1);
    await uninstallExtension('example.router', installed);
    expect(await discoverExtensions([{ directory: installed, source: 'installed' }])).toEqual([]);
  });

  it('lets later sources override the same extension ID for development', async () => {
    const preinstalled = await temporaryDirectory();
    const development = await temporaryDirectory();
    for (const [root, version] of [[preinstalled, '1.0.0'], [development, '2.0.0']] as const) {
      const packageDirectory = path.join(root, 'example');
      await fs.promises.mkdir(packageDirectory);
      await fs.promises.writeFile(path.join(packageDirectory, 'media-renamer-extension.json'), JSON.stringify({ ...validManifest, version }));
    }
    const discovered = await discoverExtensions([{ directory: preinstalled, source: 'preinstalled' }, { directory: development, source: 'development' }]);
    expect(discovered[0]).toMatchObject({ version: '2.0.0', source: 'development', canUninstall: false });
  });
});
