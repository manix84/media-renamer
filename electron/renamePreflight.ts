import fs from 'node:fs';
import path from 'node:path';
import { isVideoFile } from './mediaFiles.js';
import { isCompanionFile } from './mediaCompanions.js';

export type RenamePreflightItem = { sourcePath: string; targetPath: string };
export type RenamePreflightIssue = { code: 'source-missing' | 'target-exists'; severity: 'error'; message: string; sourcePath: string; targetPath: string };

function describePlanPathError(sourcePath: unknown, targetPath: unknown): string | undefined {
  const sourceLabel = typeof sourcePath === 'string' && sourcePath ? path.basename(sourcePath) : 'unknown file';
  if (typeof sourcePath !== 'string' || !sourcePath) return 'The rename plan contains a file with no source path.';
  if (typeof targetPath !== 'string' || !targetPath) return `No destination path was generated for “${sourceLabel}”. Check the destination folder and filename pattern.`;
  if (!path.isAbsolute(sourcePath)) return `The source path for “${sourceLabel}” is not absolute: ${sourcePath}`;
  if (!path.isAbsolute(targetPath)) return `The destination path for “${sourceLabel}” is not absolute: ${targetPath}. Choose an absolute Movies or TV destination folder in Preferences.`;
  if (!isVideoFile(sourcePath) && !isCompanionFile(sourcePath)) return `“${sourceLabel}” has an unsupported source file type (${path.extname(sourcePath) || 'no extension'}).`;
  if (!isVideoFile(targetPath) && !isCompanionFile(targetPath)) return `The generated destination for “${sourceLabel}” has an unsupported file type (${path.extname(targetPath) || 'no extension'}): ${targetPath}`;
  return undefined;
}

export function renamePreflightItems(value: unknown): RenamePreflightItem[] {
  if (!Array.isArray(value) || value.length > 5000) throw new Error('Invalid rename plan.');
  return value.map((candidate) => {
    if (!candidate || typeof candidate !== 'object') throw new Error('Invalid rename plan item.');
    const { sourcePath, targetPath } = candidate as { sourcePath?: unknown; targetPath?: unknown };
    const error = describePlanPathError(sourcePath, targetPath);
    if (error) throw new Error(error);
    return { sourcePath: sourcePath as string, targetPath: targetPath as string };
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
