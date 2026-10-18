import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { preflightRenameItems } from './renamePreflight';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'media-renamer-preflight-'));
  temporaryDirectories.push(directory);
  const sourcePath = path.join(directory, 'source.mkv');
  const targetPath = path.join(directory, 'target.mkv');
  await fs.writeFile(sourcePath, 'source');
  return { directory, sourcePath, targetPath };
}

describe('filesystem rename preflight', () => {
  it('accepts an available sibling destination', async () => {
    const { sourcePath, targetPath } = await fixture();
    await expect(preflightRenameItems([{ sourcePath, targetPath }])).resolves.toEqual([]);
  });

  it('reports missing sources and occupied destinations', async () => {
    const { directory, sourcePath, targetPath } = await fixture();
    await fs.writeFile(targetPath, 'target');
    const missingPath = path.join(directory, 'missing.mkv');
    const issues = await preflightRenameItems([{ sourcePath, targetPath }, { sourcePath: missingPath, targetPath: path.join(directory, 'other.mkv') }]);
    expect(issues.map((issue) => issue.code).sort()).toEqual(['source-missing', 'target-exists']);
  });

  it('accepts an available destination in a different directory', async () => {
    const { sourcePath } = await fixture();
    await expect(preflightRenameItems([{ sourcePath, targetPath: path.join(os.tmpdir(), 'elsewhere.mkv') }])).resolves.toEqual([]);
  });

  it('accepts supported subtitle companion paths', async () => {
    const { directory } = await fixture();
    const sourcePath = path.join(directory, 'source.en.srt');
    await fs.writeFile(sourcePath, 'subtitle');
    await expect(preflightRenameItems([{ sourcePath, targetPath: path.join(directory, 'renamed.en.srt') }])).resolves.toEqual([]);
  });

  it('identifies the file and setting when a destination is not absolute', async () => {
    const { sourcePath } = await fixture();
    await expect(preflightRenameItems([{ sourcePath, targetPath: 'Movies/renamed.mkv' }]))
      .rejects.toThrow(/destination path for “source\.mkv” is not absolute.*Preferences/i);
  });

  it('identifies unsupported generated destination types', async () => {
    const { sourcePath, directory } = await fixture();
    await expect(preflightRenameItems([{ sourcePath, targetPath: path.join(directory, 'renamed.invalid') }]))
      .rejects.toThrow(/generated destination for “source\.mkv”.*unsupported file type.*\.invalid/i);
  });
});
