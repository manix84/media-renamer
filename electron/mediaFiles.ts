import fs from 'node:fs/promises';
import path from 'node:path';

export const VIDEO_FILE_EXTENSIONS = ['mkv', 'mp4', 'm4v', 'avi', 'mov', 'webm', 'wmv', 'mpg', 'mpeg', 'ts', 'm2ts'] as const;
const VIDEO_EXTENSIONS = new Set(VIDEO_FILE_EXTENSIONS.map((extension) => `.${extension}`));
const SYSTEM_METADATA_NAMES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini', 'icon\r']);

export function isSystemMetadataPath(filePath: string): boolean {
  return filePath.split(/[\\/]/).some((part) => {
    const normalized = part.toLowerCase();
    return normalized === '__macosx' || normalized.startsWith('._') || SYSTEM_METADATA_NAMES.has(normalized);
  });
}

export function isVideoFile(filePath: string): boolean {
  return !isSystemMetadataPath(filePath) && VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function collectMediaFiles(inputPath: string, results: string[]): Promise<void> {
  if (isSystemMetadataPath(inputPath)) return;
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
