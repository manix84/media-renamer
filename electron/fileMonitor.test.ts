import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { reconcileTrackedFiles } from './fileMonitor';

const temporaryDirectories: string[] = [];
async function temporaryDirectory() {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-renamer-monitor-'));
  temporaryDirectories.push(directory);
  return directory;
}
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => fs.promises.rm(directory, { recursive: true, force: true }))));

describe('file monitoring reconciliation', () => {
  it('finds a tracked file renamed in its watched directory by identity', async () => {
    const directory = await temporaryDirectory();
    const original = path.join(directory, 'Episode 1.mkv');
    const renamed = path.join(directory, 'Episode One.mkv');
    await fs.promises.writeFile(original, 'video');
    const stats = await fs.promises.stat(original);
    await fs.promises.rename(original, renamed);

    await expect(reconcileTrackedFiles([{ path: original, dev: stats.dev, ino: stats.ino }])).resolves.toEqual([
      { type: 'moved', previousPath: original, path: renamed },
    ]);
  });

  it('finds a tracked file moved into a child directory', async () => {
    const directory = await temporaryDirectory();
    const original = path.join(directory, 'Episode 1.mkv');
    const moved = path.join(directory, 'Season 1', 'Episode 1.mkv');
    await fs.promises.writeFile(original, 'video');
    const stats = await fs.promises.stat(original);
    await fs.promises.mkdir(path.dirname(moved));
    await fs.promises.rename(original, moved);

    await expect(reconcileTrackedFiles([{ path: original, dev: stats.dev, ino: stats.ino }])).resolves.toEqual([
      { type: 'moved', previousPath: original, path: moved },
    ]);
  });

  it('reports a tracked file that has been deleted', async () => {
    const directory = await temporaryDirectory();
    const original = path.join(directory, 'Episode 1.mkv');
    await fs.promises.writeFile(original, 'video');
    const stats = await fs.promises.stat(original);
    await fs.promises.unlink(original);

    await expect(reconcileTrackedFiles([{ path: original, dev: stats.dev, ino: stats.ino }])).resolves.toEqual([
      { type: 'deleted', path: original },
    ]);
  });
});
