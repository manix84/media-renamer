import fs from 'node:fs/promises';
import path from 'node:path';

const VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4', '.avi', '.m4v', '.mov', '.webm']);

export function isVideoFile(filePath: string): boolean {
  return VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function collectMediaFiles(inputPath: string, results: string[]): Promise<void> {
  const stat = await fs.stat(inputPath);
  if (stat.isFile()) {
    if (isVideoFile(inputPath)) results.push(inputPath);
    return;
  }
  if (!stat.isDirectory()) return;

  const entries = await fs.readdir(inputPath, { withFileTypes: true });
  await Promise.all(entries.map((entry) => {
    if (entry.isSymbolicLink()) return Promise.resolve();
    return collectMediaFiles(path.join(inputPath, entry.name), results);
  }));
}

export async function expandMediaPaths(inputPaths: string[]): Promise<string[]> {
  const results: string[] = [];
  await Promise.all(inputPaths.map((inputPath) => collectMediaFiles(inputPath, results)));
  return [...new Set(results)].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}
