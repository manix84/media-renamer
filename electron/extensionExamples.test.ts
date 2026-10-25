import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeExtensionManifest } from './extensions';

const MANIFEST_NAME = 'media-renamer-extension.json';

async function findManifests(directory: string): Promise<string[]> {
  const manifests: string[] = [];
  for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) manifests.push(...await findManifests(entryPath));
    else if (entry.isFile() && entry.name === MANIFEST_NAME) manifests.push(entryPath);
  }
  return manifests;
}

describe('extension example catalogue', () => {
  it('keeps every installable example compatible with the current manifest API', async () => {
    const root = path.join(process.cwd(), 'extensions-examples');
    const manifests = await findManifests(root);
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
