import fs from 'node:fs/promises';
import path from 'node:path';

export type CompanionKind = 'subtitle' | 'metadata' | 'artwork';
export type MediaCompanion = { path: string; suffix: string; kind: CompanionKind };
export type AmbiguousCompanion = { path: string; candidateVideoPaths: string[] };
export type CompanionScan = { byVideo: Record<string, MediaCompanion[]>; ambiguous: AmbiguousCompanion[] };

const SUBTITLE_EXTENSIONS = new Set(['.srt', '.ass', '.ssa', '.sub', '.vtt']);
const ARTWORK_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ARTWORK_SUFFIX = /^[-.](?:poster|thumb|thumbnail|fanart|clearlogo|logo|banner)(?:[-.].*)?$/i;

export function isCompanionFile(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return SUBTITLE_EXTENSIONS.has(extension) || extension === '.nfo' || ARTWORK_EXTENSIONS.has(extension);
}

function kindFor(filename: string, suffix: string): CompanionKind | undefined {
  const extension = path.extname(filename).toLowerCase();
  if (SUBTITLE_EXTENSIONS.has(extension) && suffix.startsWith('.')) return 'subtitle';
  if (extension === '.nfo' && suffix.toLowerCase() === '.nfo') return 'metadata';
  if (ARTWORK_EXTENSIONS.has(extension) && ARTWORK_SUFFIX.test(suffix)) return 'artwork';
  return undefined;
}

export async function discoverMediaCompanions(videoPaths: string[]): Promise<CompanionScan> {
  const uniqueVideos = [...new Set(videoPaths)];
  const byVideo: Record<string, MediaCompanion[]> = Object.fromEntries(uniqueVideos.map((videoPath) => [videoPath, []]));
  const ambiguous: AmbiguousCompanion[] = [];
  const directories = new Map<string, string[]>();
  for (const videoPath of uniqueVideos) {
    const directory = path.dirname(videoPath);
    directories.set(directory, [...(directories.get(directory) ?? []), videoPath]);
  }

  await Promise.all([...directories].map(async ([directory, videos]) => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const candidates = videos.flatMap((videoPath) => {
        const filename = path.basename(videoPath);
        const stem = filename.slice(0, -path.extname(filename).length);
        if (!entry.name.toLocaleLowerCase().startsWith(stem.toLocaleLowerCase())) return [];
        const suffix = entry.name.slice(stem.length);
        const kind = kindFor(entry.name, suffix);
        return kind ? [{ videoPath, suffix, kind }] : [];
      });
      if (candidates.length === 1) {
        const [candidate] = candidates;
        byVideo[candidate.videoPath].push({ path: path.join(directory, entry.name), suffix: candidate.suffix, kind: candidate.kind });
      } else if (candidates.length > 1) {
        ambiguous.push({ path: path.join(directory, entry.name), candidateVideoPaths: candidates.map((candidate) => candidate.videoPath) });
      }
    }
  }));

  for (const companions of Object.values(byVideo)) companions.sort((left, right) => left.path.localeCompare(right.path, undefined, { numeric: true }));
  return { byVideo, ambiguous };
}
