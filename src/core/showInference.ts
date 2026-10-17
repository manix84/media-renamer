import { parseEpisodeCode, parseFolderEpisode, parseSeasonFolder, parseSpecialEpisode, parseStandaloneEpisode } from './episodeCode';

const standaloneEpisodePattern = /(?:^|[\s._-])ep(?:isode)?\.?[\s._-]*\d{1,4}(?=$|[\s._-])/i;

function filenameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

const genericFolders = new Set([
  'anime', 'downloads', 'media', 'movies', 'season', 'series', 'shows', 'tv', 'tv shows', 'unknown', 'unsorted', 'video', 'videos',
]);

function cleanTitle(value: string): string | undefined {
  const title = value
    .trim()
    .replace(/^\[[^\]]+\][ ._-]*/, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!title || genericFolders.has(title.toLocaleLowerCase()) || /^\d+$/.test(title)) return undefined;
  return title;
}

function folderShowCandidate(filePath: string): string | undefined {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  if (parts.length < 2) return undefined;
  const filename = filenameFromPath(filePath).replace(/\.[^.]+$/, '');
  const parentIndex = parts.length - 2;
  if (parseSeasonFolder(parts[parentIndex]) !== undefined) {
    return parseFolderEpisode(filePath) && parentIndex > 0 ? cleanTitle(parts[parentIndex - 1]) : undefined;
  }
  const explicitMarker = parseEpisodeCode(filename)?.index ?? parseSpecialEpisode(filename)?.index;
  return explicitMarker === 0 ? cleanTitle(parts[parentIndex]) : undefined;
}

export function inferShowQuery(paths: string[]): string | undefined {
  const candidates = paths.map((filePath) => {
    const filename = filenameFromPath(filePath).replace(/\.[^.]+$/, '');
    const marker = parseEpisodeCode(filename)?.index ?? parseSpecialEpisode(filename)?.index ?? standaloneEpisodePattern.exec(filename)?.index ?? parseStandaloneEpisode(filename)?.index ?? -1;
    if (marker < 1) return folderShowCandidate(filePath);
    return cleanTitle(filename.slice(0, marker));
  }).filter((candidate): candidate is string => Boolean(candidate));

  if (!candidates.length) return undefined;
  const counts = new Map<string, { value: string; count: number }>();
  for (const candidate of candidates) {
    const key = candidate.toLocaleLowerCase();
    const current = counts.get(key);
    counts.set(key, { value: current?.value ?? candidate, count: (current?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((left, right) => right.count - left.count || right.value.length - left.value.length)[0]?.value;
}
