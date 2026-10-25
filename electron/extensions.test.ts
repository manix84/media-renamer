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
    const manifest = normalizeExtensionManifest({ ...validManifest, mediaSettingsTabs: [{ id: 'example-shows', label: 'Example Shows', mediaKind: 'show', note: 'Used in Shows.', baseFolderSettingKey: 'showFolder', folderTemplateSettingKey: 'showFolderTemplate', fileTemplateSettingKey: 'episodeTemplate', defaultFolderTemplate: '{{show.name}}/{{seasonFolder}}', defaultFileTemplate: '{{show.name}} - {{episode.range}}' }] }, 'installed');
    expect(manifest.mediaSettingsTabs?.[0]).toMatchObject({ id: 'example-shows', mediaKind: 'show', baseFolderSettingKey: 'showFolder', defaultFileTemplate: '{{show.name}} - {{episode.range}}' });
  });

  it('accepts bounded technical matching, badge tones, and warnings', () => {
    const manifest = normalizeExtensionManifest({
      ...validManifest,
      match: { mediaKinds: ['movie'], resolutions: ['2160p'], sources: ['BluRay'], videoCodecs: ['H.265'], audioLanguages: ['eng'], flags: ['AI Upscale'], editions: ["Director's Cut"] },
      badges: [{ label: 'Review', tone: 'warning' }],
      warnings: [{ message: 'Review this source.', tone: 'warning' }],
    }, 'installed');
    expect(manifest.match).toMatchObject({ mediaKinds: ['movie'], resolutions: ['2160p'], audioLanguages: ['eng'] });
    expect(manifest.badges).toEqual([{ label: 'Review', tone: 'warning' }]);
    expect(manifest.warnings).toEqual([{ message: 'Review this source.', tone: 'warning' }]);
  });

  it('rejects unknown contribution tones and unbounded match values', () => {
    expect(() => normalizeExtensionManifest({ ...validManifest, badges: [{ label: 'Bad', tone: 'purple' }] }, 'installed')).toThrow('badge tone');
    expect(() => normalizeExtensionManifest({ ...validManifest, warnings: [{ message: 'Bad', tone: 'block' }] }, 'installed')).toThrow('warning tone');
    expect(() => normalizeExtensionManifest({ ...validManifest, match: { resolutions: ['x'.repeat(41)] } }, 'installed')).toThrow('matching rule');
  });

  it('normalizes exact HTTPS metadata-network capability origins', () => {
    const manifest = normalizeExtensionManifest({ ...validManifest, capabilities: [{ id: 'network.metadata', reason: 'Search an approved metadata provider.', origins: ['https://graphql.anilist.co', 'https://graphql.anilist.co/'] }] }, 'installed');
    expect(manifest.capabilities).toEqual([{ id: 'network.metadata', reason: 'Search an approved metadata provider.', origins: ['https://graphql.anilist.co'] }]);
    expect(() => normalizeExtensionManifest({ ...validManifest, capabilities: [{ id: 'network.metadata', reason: 'Unsafe.', origins: ['http://localhost:8080'] }] }, 'installed')).toThrow('exact HTTPS origins');
    expect(() => normalizeExtensionManifest({ ...validManifest, capabilities: [{ id: 'shell.execute', reason: 'Unsafe.', origins: ['https://example.com'] }] }, 'installed')).toThrow('capability');
  });

  it('validates declarative metadata adapters against their network capability', () => {
    const adapter = {
      id: 'anilist', label: 'AniList', capability: 'network.metadata', transport: 'graphql-json', origin: 'https://graphql.anilist.co', endpointPath: '/',
      operations: [{ id: 'anime.search', label: 'Search anime', kind: 'search', mediaKinds: ['show', 'movie'], query: 'query ($query: String) { Media(search: $query) { id } }', inputs: [{ name: 'query', type: 'string', required: true, maximumLength: 200 }] }],
    };
    const capabilities = [{ id: 'network.metadata', reason: 'Search AniList.', origins: ['https://graphql.anilist.co'] }];
    expect(normalizeExtensionManifest({ ...validManifest, capabilities, metadataAdapters: [adapter] }, 'installed').metadataAdapters?.[0]).toMatchObject({ id: 'anilist', transport: 'graphql-json' });
    expect(() => normalizeExtensionManifest({ ...validManifest, metadataAdapters: [adapter] }, 'installed')).toThrow('must be declared');
    expect(() => normalizeExtensionManifest({ ...validManifest, capabilities, metadataAdapters: [{ ...adapter, origin: 'https://example.com' }] }, 'installed')).toThrow('must be declared');
    expect(() => normalizeExtensionManifest({ ...validManifest, capabilities, metadataAdapters: [{ ...adapter, operations: [{ ...adapter.operations[0], inputs: [{ name: 'query', type: 'string', required: true, maximumLength: 20_000 }] }] }] }, 'installed')).toThrow('input is invalid');
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
