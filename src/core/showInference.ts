import { parseEpisodeCode } from './episodeCode';

const standaloneEpisodePattern = /(?:^|[\s._-])ep(?:isode)?\.?[\s._-]*\d{1,4}(?=$|[\s._-])/i;

function filenameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export function inferShowQuery(paths: string[]): string | undefined {
  const candidates = paths.map((filePath) => {
    const filename = filenameFromPath(filePath).replace(/\.[^.]+$/, '');
    const marker = parseEpisodeCode(filename)?.index ?? standaloneEpisodePattern.exec(filename)?.index ?? -1;
    if (marker < 1) return undefined;
    return filename
      .slice(0, marker)
      .trim()
      .replace(/^\[[^\]]+\][ ._-]*/, '')
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || undefined;
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
