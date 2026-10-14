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
  status: 'completed' | 'undone';
  items: RenamePreflightItem[];
};

async function exists(filePath: string): Promise<boolean> {
  try { await fs.promises.lstat(filePath); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function moveFile(sourcePath: string, targetPath: string): Promise<void> {
  if (sourcePath === targetPath) return;
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  const caseOnly = sourcePath.toLocaleLowerCase() === targetPath.toLocaleLowerCase();
  const intermediatePath = caseOnly ? path.join(path.dirname(sourcePath), `.media-renamer-${crypto.randomUUID()}.tmp`) : undefined;
  if (intermediatePath) {
    await fs.promises.rename(sourcePath, intermediatePath);
    try { await fs.promises.rename(intermediatePath, targetPath); }
    catch (error) { await fs.promises.rename(intermediatePath, sourcePath).catch(() => undefined); throw error; }
    return;
  }
  try { await fs.promises.rename(sourcePath, targetPath); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    const temporaryPath = path.join(path.dirname(targetPath), `.media-renamer-${crypto.randomUUID()}.tmp`);
    try {
      await fs.promises.copyFile(sourcePath, temporaryPath, fs.constants.COPYFILE_EXCL);
      await fs.promises.rename(temporaryPath, targetPath);
      await fs.promises.unlink(sourcePath);
    } catch (copyError) {
      await fs.promises.rm(temporaryPath, { force: true }).catch(() => undefined);
      if (await exists(targetPath)) await fs.promises.rm(targetPath, { force: true }).catch(() => undefined);
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

export async function executeRenamePlan(value: unknown, historyDirectory: string): Promise<{ operation: RenameOperation; logPath: string }> {
  const items = renamePreflightItems(value).filter((item) => item.sourcePath !== item.targetPath);
  if (!items.length) throw new Error('The rename plan has no file operations.');
  const issues = await preflightRenameItems(items);
  if (issues.length) throw new Error(`Rename preflight failed: ${issues[0].message}`);
  const completed: RenamePreflightItem[] = [];
  try {
    for (const item of items) {
      await moveFile(item.sourcePath, item.targetPath);
      completed.push(item);
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
  const now = new Date().toISOString();
  const operation: RenameOperation = { version: 1, id: crypto.randomUUID(), createdAt: now, completedAt: now, status: 'completed', items };
  try {
    return { operation, logPath: await writeOperation(historyDirectory, operation) };
  } catch (error) {
    for (const item of [...completed].reverse()) await moveFile(item.targetPath, item.sourcePath).catch(() => undefined);
    throw new Error(`Could not write the operation log; renamed files were rolled back. ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function undoRenameOperation(operation: RenameOperation, logPath: string): Promise<RenameOperation> {
  if (operation.status !== 'completed') throw new Error('This rename operation has already been undone.');
  for (const item of operation.items) {
    if (!(await exists(item.targetPath))) throw new Error(`Cannot undo because a renamed file is missing: ${item.targetPath}`);
    if (await exists(item.sourcePath)) throw new Error(`Cannot undo because the original path is occupied: ${item.sourcePath}`);
  }
  const restored: RenamePreflightItem[] = [];
  try {
    for (const item of [...operation.items].reverse()) {
      await moveFile(item.targetPath, item.sourcePath);
      restored.push(item);
    }
  } catch (error) {
    for (const item of restored.reverse()) await moveFile(item.sourcePath, item.targetPath).catch(() => undefined);
    throw new Error(`Undo failed; restored files were moved back to their renamed paths. ${error instanceof Error ? error.message : String(error)}`);
  }
  const undone = { ...operation, status: 'undone' as const, undoneAt: new Date().toISOString() };
  await fs.promises.writeFile(logPath, `${JSON.stringify(undone, null, 2)}\n`, 'utf8');
  return undone;
}
