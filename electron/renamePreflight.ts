import fs from 'node:fs';
import path from 'node:path';
import { isVideoFile } from './mediaFiles.js';

type RenamePreflightItem = { sourcePath: string; targetPath: string };
export type RenamePreflightIssue = { code: 'source-missing' | 'target-exists'; severity: 'error'; message: string; sourcePath: string; targetPath: string };

function renamePreflightItems(value: unknown): RenamePreflightItem[] {
  if (!Array.isArray(value) || value.length > 5000) throw new Error('Invalid rename plan.');
  return value.map((candidate) => {
    if (!candidate || typeof candidate !== 'object') throw new Error('Invalid rename plan item.');
    const { sourcePath, targetPath } = candidate as { sourcePath?: unknown; targetPath?: unknown };
    if (typeof sourcePath !== 'string' || typeof targetPath !== 'string' || !path.isAbsolute(sourcePath) || !path.isAbsolute(targetPath) || !isVideoFile(sourcePath) || !isVideoFile(targetPath)) throw new Error('Invalid rename plan path.');
    return { sourcePath, targetPath };
  });
}

export async function preflightRenameItems(value: unknown): Promise<RenamePreflightIssue[]> {
  const items = renamePreflightItems(value);
  const issues: RenamePreflightIssue[] = [];
  await Promise.all(items.map(async ({ sourcePath, targetPath }) => {
    let source: fs.Stats;
    try {
      source = await fs.promises.stat(sourcePath);
    } catch {
      issues.push({ code: 'source-missing', severity: 'error', message: 'The source file no longer exists.', sourcePath, targetPath });
      return;
    }
    if (sourcePath === targetPath) return;
    try {
      const target = await fs.promises.stat(targetPath);
      if (source.dev !== target.dev || source.ino !== target.ino) issues.push({ code: 'target-exists', severity: 'error', message: 'A different file already exists at the destination.', sourcePath, targetPath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }));
  return issues;
}
