import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { executeRenamePlan, undoRenameOperation } from './renameExecution';

const temporaryDirectories: string[] = [];
async function temporaryDirectory() {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-renamer-execution-'));
  temporaryDirectories.push(directory);
  return directory;
}
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => fs.promises.rm(directory, { recursive: true, force: true }))));

describe('rename execution', () => {
  it('moves files, writes an operation log, and undoes the operation', async () => {
    const root = await temporaryDirectory();
    const source = path.join(root, 'incoming', 'Old.mkv');
    const target = path.join(root, 'library', 'Show', 'New.mkv');
    await fs.promises.mkdir(path.dirname(source), { recursive: true });
    await fs.promises.writeFile(source, 'video');
    const executed = await executeRenamePlan([{ sourcePath: source, targetPath: target }], path.join(root, 'history'));
    await expect(fs.promises.readFile(target, 'utf8')).resolves.toBe('video');
    await expect(fs.promises.stat(source)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.promises.stat(executed.logPath)).resolves.toBeDefined();
    const undone = await undoRenameOperation(executed.operation, executed.logPath);
    expect(undone.status).toBe('undone');
    await expect(fs.promises.readFile(source, 'utf8')).resolves.toBe('video');
    await expect(fs.promises.stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects the full plan before moving anything when a target exists', async () => {
    const root = await temporaryDirectory();
    const first = path.join(root, 'one.mkv');
    const second = path.join(root, 'two.mkv');
    const occupied = path.join(root, 'occupied.mkv');
    await Promise.all([fs.promises.writeFile(first, 'one'), fs.promises.writeFile(second, 'two'), fs.promises.writeFile(occupied, 'occupied')]);
    await expect(executeRenamePlan([
      { sourcePath: first, targetPath: path.join(root, 'renamed.mkv') },
      { sourcePath: second, targetPath: occupied },
    ], path.join(root, 'history'))).rejects.toThrow(/preflight failed/i);
    await expect(fs.promises.readFile(first, 'utf8')).resolves.toBe('one');
  });
});
