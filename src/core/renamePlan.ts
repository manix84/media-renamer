import type { RenamePlan, RenamePlanIssue, RenamePlanItem } from './types';

export interface RenamePlanInput {
  sourcePath: string;
  targetName?: string;
  targetDirectory?: string;
  configurationError?: string;
  matchStatus: RenamePlanItem['matchStatus'];
  confidence: number;
}

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function dirname(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return index < 0 ? '' : filePath.slice(0, index);
}

function joinSibling(sourcePath: string, targetName: string): string {
  const directory = dirname(sourcePath);
  const separator = sourcePath.includes('\\') && !sourcePath.includes('/') ? '\\' : '/';
  return directory ? `${directory}${separator}${targetName}` : targetName;
}

function joinDirectory(directory: string, targetName: string): string {
  const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
  return `${directory.replace(/[\\/]+$/, '')}${separator}${targetName}`;
}

function issue(code: RenamePlanIssue['code'], severity: RenamePlanIssue['severity'], message: string, sourcePath: string, targetPath?: string): RenamePlanIssue {
  return { code, severity, message, sourcePath, targetPath };
}

export function filenameProblem(filename: string): string | undefined {
  if (!filename || filename === '.' || filename === '..') return 'The destination filename is empty or reserved.';
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(filename)) return 'The destination filename contains characters that are invalid on common filesystems.';
  if (/[ .]$/.test(filename)) return 'The destination filename cannot end with a space or period.';
  const stem = filename.replace(/\.[^.]*$/, '');
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(stem)) return 'The destination filename is reserved by Windows.';
  if (new TextEncoder().encode(filename).length > 255) return 'The destination filename is longer than 255 bytes.';
  return undefined;
}

export function createRenamePlan(inputs: RenamePlanInput[]): RenamePlan {
  const items = inputs.map<RenamePlanItem>((input) => {
    const sourceName = basename(input.sourcePath);
    const targetPath = input.targetName && !input.configurationError ? input.targetDirectory ? joinDirectory(input.targetDirectory, input.targetName) : joinSibling(input.sourcePath, input.targetName) : undefined;
    const issues: RenamePlanIssue[] = [];

    if (input.configurationError) {
      issues.push(issue('invalid-destination', 'error', input.configurationError, input.sourcePath));
    } else if (!input.targetName || !targetPath || input.matchStatus === 'unmatched' || input.matchStatus === 'pending') {
      issues.push(issue('unresolved-match', 'error', 'Choose an episode match before renaming this file.', input.sourcePath));
    } else {
      if (input.matchStatus === 'review') issues.push(issue('review-required', 'error', 'Confirm or change this suggested episode match before renaming.', input.sourcePath, targetPath));
      const problem = filenameProblem(input.targetName);
      if (problem) issues.push(issue('invalid-filename', 'error', problem, input.sourcePath, targetPath));
      if (targetPath === input.sourcePath) issues.push(issue('no-change', 'warning', 'The source already has the proposed filename.', input.sourcePath, targetPath));
      else if (targetPath.toLocaleLowerCase() === input.sourcePath.toLocaleLowerCase()) issues.push(issue('case-only-rename', 'warning', 'This rename changes only filename casing and may require an intermediate name.', input.sourcePath, targetPath));
    }

    return { sourcePath: input.sourcePath, sourceName, targetPath, targetName: input.targetName, matchStatus: input.matchStatus, confidence: input.confidence, issues };
  });

  const targets = new Map<string, RenamePlanItem[]>();
  for (const item of items) {
    if (!item.targetPath) continue;
    const key = item.targetPath.toLocaleLowerCase();
    targets.set(key, [...(targets.get(key) ?? []), item]);
  }
  for (const duplicates of targets.values()) {
    if (duplicates.length < 2) continue;
    for (const item of duplicates) item.issues.push(issue('duplicate-target', 'error', `${duplicates.length} files would use the same destination filename.`, item.sourcePath, item.targetPath));
  }

  const issues = items.flatMap((item) => item.issues);
  return {
    version: 1,
    items,
    destinationDirectories: [...new Set(items.flatMap((item) => item.targetPath && dirname(item.targetPath).toLocaleLowerCase() !== dirname(item.sourcePath).toLocaleLowerCase() ? [dirname(item.targetPath)] : []))],
    issues,
    readyCount: items.filter((item) => item.targetPath && !item.issues.some((entry) => entry.severity === 'error' || entry.code === 'no-change')).length,
    blockedCount: items.filter((item) => item.issues.some((entry) => entry.severity === 'error')).length,
    warningCount: issues.filter((entry) => entry.severity === 'warning').length,
  };
}
