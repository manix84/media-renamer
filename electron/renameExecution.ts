import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { preflightRenameItems, renamePreflightItems, type RenamePreflightItem } from './renamePreflight.js';

export type RenameOperation = {
  version: 1;
  id: string;
  createdAt: string;
  completedAt: string;
  undoneAt?: string;
  status: 'completed' | 'stopped' | 'undone';
  items: RenamePreflightItem[];
  removedSourceDirectories?: string[];
  sourceDirectoryCleanupWarnings?: string[];
  externalLogPath?: string;
  externalLogWarning?: string;
};

export type RenameControl = 'stop' | 'undo';
export type RenameExecutionOptions = { removeEmptySourceParents?: boolean; createExternalLog?: boolean; externalLogDirectory?: string; control?: () => RenameControl | undefined };

async function exists(filePath: string): Promise<boolean> {
  try { await fs.promises.lstat(filePath); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function targetOccupied(sourcePath: string, targetPath: string): Promise<boolean> {
  if (sourcePath === targetPath) return false;
  let target: fs.Stats;
  try {
    target = await fs.promises.stat(targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
  try {
    const source = await fs.promises.stat(sourcePath);
    return source.dev !== target.dev || source.ino !== target.ino;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
}

export type RenameCollisionGroup = { items: RenamePreflightItem[] };

function incrementedGroup(group: RenamePreflightItem[], increment: number): RenamePreflightItem[] {
  const primary = group[0];
  const extension = path.extname(primary.targetPath);
  const root = primary.targetPath.slice(0, -extension.length);
  const incrementedRoot = `${root} (${increment})`;
  return group.map((item) => ({ ...item, targetPath: item.targetPath.startsWith(root) ? `${incrementedRoot}${item.targetPath.slice(root.length)}` : `${item.targetPath.slice(0, -path.extname(item.targetPath).length)} (${increment})${path.extname(item.targetPath)}` }));
}

export async function resolveRenameCollisions(value: unknown): Promise<RenameCollisionGroup[]> {
  if (!Array.isArray(value) || value.length > 5000) throw new Error('Invalid rename groups.');
  const groups = value.map((group) => {
    if (!group || typeof group !== 'object' || !Array.isArray((group as { items?: unknown }).items)) throw new Error('Invalid rename group.');
    return { items: renamePreflightItems((group as { items: unknown[] }).items) };
  });
  const reserved = new Set<string>();
  const resolved: RenameCollisionGroup[] = [];
  for (const group of groups) {
    let candidate = group.items;
    for (let increment = 2; ; increment += 1) {
      if (increment > 1000) throw new Error('Could not find an available incremental filename after 999 attempts.');
      const unavailable = await Promise.all(candidate.map(async (item) => {
        const key = item.targetPath.toLocaleLowerCase();
        return reserved.has(key) || await targetOccupied(item.sourcePath, item.targetPath);
      }));
      if (!unavailable.some(Boolean)) break;
      candidate = incrementedGroup(group.items, increment);
    }
    for (const item of candidate) reserved.add(item.targetPath.toLocaleLowerCase());
    resolved.push({ items: candidate });
  }
  return resolved;
}

async function moveFile(sourcePath: string, targetPath: string): Promise<void> {
  if (sourcePath === targetPath) return;
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  const caseOnly = sourcePath.toLocaleLowerCase() === targetPath.toLocaleLowerCase();
  const intermediatePath = caseOnly ? path.join(path.dirname(sourcePath), `.media-renamer-${crypto.randomUUID()}.tmp`) : undefined;
  if (intermediatePath) {
    await fs.promises.rename(sourcePath, intermediatePath);
    let published = false;
    try {
      await fs.promises.link(intermediatePath, targetPath);
      published = true;
      await fs.promises.unlink(intermediatePath);
    }
    catch (error) {
      if (published) await fs.promises.rm(targetPath, { force: true }).catch(() => undefined);
      await fs.promises.rename(intermediatePath, sourcePath).catch(() => undefined);
      throw error;
    }
    return;
  }
  try {
    await fs.promises.link(sourcePath, targetPath);
    try { await fs.promises.unlink(sourcePath); }
    catch (error) { await fs.promises.rm(targetPath, { force: true }).catch(() => undefined); throw error; }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    const temporaryPath = path.join(path.dirname(targetPath), `.media-renamer-${crypto.randomUUID()}.tmp`);
    let published = false;
    try {
      await fs.promises.copyFile(sourcePath, temporaryPath, fs.constants.COPYFILE_EXCL);
      await fs.promises.link(temporaryPath, targetPath);
      published = true;
      await fs.promises.unlink(temporaryPath);
      try { await fs.promises.unlink(sourcePath); }
      catch (unlinkError) { await fs.promises.rm(targetPath, { force: true }).catch(() => undefined); throw unlinkError; }
    } catch (copyError) {
      await fs.promises.rm(temporaryPath, { force: true }).catch(() => undefined);
      if (published) await fs.promises.rm(targetPath, { force: true }).catch(() => undefined);
      throw copyError;
    }
  }
}

async function writeOperation(historyDirectory: string, operation: RenameOperation): Promise<string> {
  await fs.promises.mkdir(historyDirectory, { recursive: true });
  const logPath = path.join(historyDirectory, `${operation.createdAt.replace(/[:.]/g, '-')}-${operation.id}.json`);
  const temporaryPath = `${logPath}.tmp`;
  await fs.promises.writeFile(temporaryPath, `${JSON.stringify(operation, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await fs.promises.rename(temporaryPath, logPath);
  return logPath;
}

function commonTargetDirectory(items: RenamePreflightItem[]): string {
  let common = path.dirname(items[0].targetPath);
  for (const item of items.slice(1)) {
    const directory = path.dirname(item.targetPath);
    while (directory !== common && !directory.startsWith(`${common}${path.sep}`)) {
      const parent = path.dirname(common);
      if (parent === common) return common;
      common = parent;
    }
  }
  return common;
}

async function writeExternalOperation(directory: string, operation: RenameOperation): Promise<string> {
  await fs.promises.mkdir(directory, { recursive: true });
  const timestamp = operation.completedAt.replace(/[:.]/g, '-');
  const logPath = path.join(directory, `media-renamer-${timestamp}-${operation.id}.json`);
  await fs.promises.writeFile(logPath, `${JSON.stringify(operation, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return logPath;
}

async function removeEmptySourceParents(items: RenamePreflightItem[]): Promise<{ removed: string[]; warnings: string[] }> {
  const directories = [...new Set(items
    .filter((item) => path.dirname(item.sourcePath) !== path.dirname(item.targetPath))
    .map((item) => path.dirname(item.sourcePath)))]
    .filter((directory) => directory !== path.parse(directory).root)
    .sort((left, right) => right.length - left.length);
  const removed: string[] = [];
  const warnings: string[] = [];
  for (const directory of directories) {
    try {
      await fs.promises.rmdir(directory);
      removed.push(directory);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTEMPTY' && code !== 'EEXIST') warnings.push(`Could not remove empty source folder ${directory}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { removed, warnings };
}

export async function executeRenamePlan(value: unknown, historyDirectory: string, onProgress?: (completed: number, total: number, operation?: 'rename' | 'undo') => void, options: RenameExecutionOptions = {}): Promise<{ operation: RenameOperation; logPath: string }> {
  const items = renamePreflightItems(value).filter((item) => item.sourcePath !== item.targetPath);
  if (!items.length) throw new Error('The rename plan has no file operations.');
  const issues = await preflightRenameItems(items);
  if (issues.length) throw new Error(`Rename preflight failed: ${issues[0].message}`);
  const completed: RenamePreflightItem[] = [];
  let control: RenameControl | undefined;
  try {
    for (const item of items) {
      control = options.control?.();
      if (control) break;
      await moveFile(item.sourcePath, item.targetPath);
      completed.push(item);
      onProgress?.(completed.length, items.length, 'rename');
      control = options.control?.();
      if (control) break;
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const item of completed.reverse()) {
      try { await moveFile(item.targetPath, item.sourcePath); }
      catch (rollbackError) { rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : String(rollbackError)); }
    }
    const detail = rollbackErrors.length ? ` Rollback also failed: ${rollbackErrors.join('; ')}` : ' Completed moves were rolled back.';
    throw new Error(`${error instanceof Error ? error.message : String(error)}${detail}`);
  }
  if (control === 'undo') {
    const rollbackErrors: string[] = [];
    let restored = 0;
    for (const item of [...completed].reverse()) {
      try {
        await moveFile(item.targetPath, item.sourcePath);
        restored += 1;
        onProgress?.(restored, completed.length, 'undo');
      } catch (error) {
        rollbackErrors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (rollbackErrors.length) throw new Error(`Undo was requested, but some completed renames could not be restored: ${rollbackErrors.join('; ')}`);
  }
  const status = control === 'undo' ? 'undone' : control === 'stop' ? 'stopped' : 'completed';
  const cleanup = status === 'completed' && options.removeEmptySourceParents ? await removeEmptySourceParents(items) : { removed: [], warnings: [] };
  const now = new Date().toISOString();
  const operation: RenameOperation = {
    version: 1,
    id: crypto.randomUUID(),
    createdAt: now,
    completedAt: now,
    status,
    items: completed,
    ...(status === 'undone' ? { undoneAt: now } : {}),
    ...(cleanup.removed.length ? { removedSourceDirectories: cleanup.removed } : {}),
    ...(cleanup.warnings.length ? { sourceDirectoryCleanupWarnings: cleanup.warnings } : {}),
  };
  try {
    const logPath = await writeOperation(historyDirectory, operation);
    if (options.createExternalLog) {
      try {
        operation.externalLogPath = await writeExternalOperation(options.externalLogDirectory ?? commonTargetDirectory(items), operation);
      } catch (error) {
        operation.externalLogWarning = `Could not write the requested operation log: ${error instanceof Error ? error.message : String(error)}`;
      }
      await fs.promises.writeFile(logPath, `${JSON.stringify(operation, null, 2)}\n`, 'utf8').catch(() => undefined);
    }
    return { operation, logPath };
  } catch (error) {
    if (status !== 'undone') for (const item of [...completed].reverse()) await moveFile(item.targetPath, item.sourcePath).catch(() => undefined);
    throw new Error(`Could not write the operation log; renamed files were rolled back. ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function undoRenameOperation(operation: RenameOperation, logPath: string, onProgress?: (completed: number, total: number) => void): Promise<RenameOperation> {
  if (operation.status !== 'completed' && operation.status !== 'stopped') throw new Error('This rename operation has already been undone.');
  for (const item of operation.items) {
    if (!(await exists(item.targetPath))) throw new Error(`Cannot undo because a renamed file is missing: ${item.targetPath}`);
    if (await exists(item.sourcePath)) throw new Error(`Cannot undo because the original path is occupied: ${item.sourcePath}`);
  }
  const restored: RenamePreflightItem[] = [];
  try {
    for (const item of [...operation.items].reverse()) {
      await moveFile(item.targetPath, item.sourcePath);
      restored.push(item);
      onProgress?.(restored.length, operation.items.length);
    }
  } catch (error) {
    for (const item of restored.reverse()) await moveFile(item.sourcePath, item.targetPath).catch(() => undefined);
    throw new Error(`Undo failed; restored files were moved back to their renamed paths. ${error instanceof Error ? error.message : String(error)}`);
  }
  const undone = { ...operation, status: 'undone' as const, undoneAt: new Date().toISOString() };
  await fs.promises.writeFile(logPath, `${JSON.stringify(undone, null, 2)}\n`, 'utf8');
  return undone;
}

export async function readLatestRenameOperation(historyDirectory: string): Promise<{ operation: RenameOperation; logPath: string } | undefined> {
  let names: string[];
  try { names = await fs.promises.readdir(historyDirectory); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  const candidates = names.filter((name) => name.endsWith('.json')).sort().reverse();
  for (const name of candidates) {
    const logPath = path.join(historyDirectory, name);
    try {
      const value = JSON.parse(await fs.promises.readFile(logPath, 'utf8')) as Partial<RenameOperation>;
      if (value.version !== 1 || typeof value.id !== 'string' || typeof value.createdAt !== 'string' || typeof value.completedAt !== 'string' || (value.status !== 'completed' && value.status !== 'stopped' && value.status !== 'undone')) continue;
      const items = renamePreflightItems(value.items);
      return { operation: { ...value, items } as RenameOperation, logPath };
    } catch {
      // Ignore incomplete or unrelated files and continue to the previous log.
    }
  }
  return undefined;
}
