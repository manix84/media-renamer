import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeExtensionManifest } from './extensions';

const MANIFEST_NAME = 'media-renamer-extension.json';

async function findNamedFiles(directory: string, filename: string): Promise<string[]> {
  const manifests: string[] = [];
  for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) manifests.push(...await findNamedFiles(entryPath, filename));
    else if (entry.isFile() && entry.name === filename) manifests.push(entryPath);
  }
  return manifests;
}

describe('extension example catalogue', () => {
  it('keeps every installable example compatible with the current manifest API', async () => {
    const root = path.join(process.cwd(), 'extensions-examples');
    const manifests = await findNamedFiles(root, MANIFEST_NAME);
    expect(manifests.length).toBeGreaterThan(0);
    for (const manifestPath of manifests) {
      const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8')) as unknown;
      expect(() => normalizeExtensionManifest(manifest, 'development'), manifestPath).not.toThrow();
    }
  });

  it('keeps contract example manifests compatible with their declared API', async () => {
    const root = path.join(process.cwd(), 'extensions-examples');
    const manifests = await findNamedFiles(root, 'manifest.example.json');
    expect(manifests.length).toBeGreaterThan(0);
    for (const manifestPath of manifests) {
      const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8')) as unknown;
      expect(() => normalizeExtensionManifest(manifest, 'development'), manifestPath).not.toThrow();
    }
  });

  it('does not place installable manifests at the catalogue root', async () => {
    await expect(fs.promises.stat(path.join(process.cwd(), 'extensions-examples', MANIFEST_NAME))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
