import type { MediaCompanion, RenamePlan, RenamePlanIssue, RenamePlanItem } from './types';

export interface RenamePlanInput {
  sourcePath: string;
  targetName?: string;
  targetDirectory?: string;
  configurationError?: string;
  companionError?: string;
  companions?: MediaCompanion[];
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

export function destinationDirectoryForSource(sourcePath: string, baseFolder: string, mediaFolder: string): string {
  if (baseFolder) return joinDirectory(baseFolder, mediaFolder);
  const sourceDirectory = dirname(sourcePath);
  return sourceDirectory ? joinDirectory(sourceDirectory, mediaFolder) : mediaFolder;
}

function issue(code: RenamePlanIssue['code'], severity: RenamePlanIssue['severity'], message: string, sourcePath: string, targetPath?: string): RenamePlanIssue {
  return { code, severity, message, sourcePath, targetPath };
}

function withoutExtension(filename: string): string {
  const index = filename.lastIndexOf('.');
  return index > 0 ? filename.slice(0, index) : filename;
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
      issues.push(issue('unresolved-match', 'error', 'Choose media metadata before renaming this file.', input.sourcePath));
    } else {
      if (input.matchStatus === 'review') issues.push(issue('review-required', 'error', 'Confirm or change this suggested match before renaming.', input.sourcePath, targetPath));
      const problem = filenameProblem(input.targetName);
      if (problem) issues.push(issue('invalid-filename', 'error', problem, input.sourcePath, targetPath));
      if (targetPath === input.sourcePath) issues.push(issue('no-change', 'warning', 'The source already has the proposed filename.', input.sourcePath, targetPath));
      else if (targetPath.toLocaleLowerCase() === input.sourcePath.toLocaleLowerCase()) issues.push(issue('case-only-rename', 'warning', 'This rename changes only filename casing and may require an intermediate name.', input.sourcePath, targetPath));
    }

    if (input.companionError) issues.push(issue('ambiguous-companion', 'error', input.companionError, input.sourcePath, targetPath));

    const companions = (input.companions ?? []).map((companion) => {
      const targetName = input.targetName ? `${withoutExtension(input.targetName)}${companion.suffix}` : undefined;
      const companionTargetPath = targetName && targetPath ? input.targetDirectory ? joinDirectory(input.targetDirectory, targetName) : joinSibling(companion.path, targetName) : undefined;
      const companionIssues: RenamePlanIssue[] = [];
      if (targetName && companionTargetPath) {
        const problem = filenameProblem(targetName);
        if (problem) companionIssues.push(issue('invalid-filename', 'error', problem, companion.path, companionTargetPath));
        if (companionTargetPath === companion.path) companionIssues.push(issue('no-change', 'warning', 'The companion file already has the proposed filename.', companion.path, companionTargetPath));
        else if (companionTargetPath.toLocaleLowerCase() === companion.path.toLocaleLowerCase()) companionIssues.push(issue('case-only-rename', 'warning', 'This companion rename changes only filename casing.', companion.path, companionTargetPath));
      }
      return { sourcePath: companion.path, sourceName: basename(companion.path), targetPath: companionTargetPath, targetName, suffix: companion.suffix, kind: companion.kind, issues: companionIssues };
    });

    return { sourcePath: input.sourcePath, sourceName, targetPath, targetName: input.targetName, matchStatus: input.matchStatus, confidence: input.confidence, companions, issues };
  });

  const targets = new Map<string, Array<{ sourcePath: string; targetPath: string; issues: RenamePlanIssue[] }>>();
  for (const item of items) {
    for (const target of [item, ...item.companions]) {
      if (!target.targetPath) continue;
      const key = target.targetPath.toLocaleLowerCase();
      targets.set(key, [...(targets.get(key) ?? []), { sourcePath: target.sourcePath, targetPath: target.targetPath, issues: target.issues }]);
    }
  }
  for (const duplicates of targets.values()) {
    if (duplicates.length < 2) continue;
    for (const target of duplicates) target.issues.push(issue('duplicate-target', 'error', `${duplicates.length} files would use the same destination filename.`, target.sourcePath, target.targetPath));
  }

  const itemIssues = (item: RenamePlanItem) => [...item.issues, ...item.companions.flatMap((companion) => companion.issues)];
  const issues = items.flatMap(itemIssues);
  return {
    version: 1,
    items,
    destinationDirectories: [...new Set(items.flatMap((item) => item.targetPath && dirname(item.targetPath).toLocaleLowerCase() !== dirname(item.sourcePath).toLocaleLowerCase() ? [dirname(item.targetPath)] : []))],
    issues,
    readyCount: items.filter((item) => item.targetPath && !itemIssues(item).some((entry) => entry.severity === 'error' || entry.code === 'no-change')).length,
    blockedCount: items.filter((item) => itemIssues(item).some((entry) => entry.severity === 'error')).length,
    warningCount: issues.filter((entry) => entry.severity === 'warning').length,
  };
}
