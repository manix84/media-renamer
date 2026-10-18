import { stripEditionTokens, stripTrailingMovieEdition } from './releaseTags';
import { stripMovieVideoRoleTokens, type MovieVideoRole } from './movieVideoRole';

const releaseTokenPattern = /\b(?:\d{3,4}x\d{3,4}|2160p|1080p|720p|576p|480p|uhd|hdr10?|dv|dolby[ ._-]?vision|web[ ._-]?(?:dl|rip)|blu[ ._-]?ray|b[dr]rip|hdtv|dvd[ ._-]?rip|remux|x26[45]|h26[45]|hevc|av1|aac|ac3|eac3|dts|truehd|atmos|proper|repack|yify|rarbg)\b/i;

function filenameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function cleanTitle(value: string): string {
  return value
    .replace(/^\[[^\]]+\][ ._-]*/, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferCandidate(filePath: string, latestYear: number, role: MovieVideoRole = { kind: 'main' }): string | undefined {
  const stem = filenameFromPath(filePath).replace(/\.[^.]+$/, '');
  const normalized = cleanTitle(stripMovieVideoRoleTokens(stripEditionTokens(stem), role));
  const years = [...normalized.matchAll(/\b((?:18|19|20)\d{2})\b/g)]
    .filter((match) => Number(match[1]) <= latestYear);

  for (const match of years.reverse()) {
    const title = cleanTitle(stripEditionTokens(normalized.slice(0, match.index)));
    const suffix = normalized.slice((match.index ?? 0) + match[0].length).trim();
    if (title && (!suffix || releaseTokenPattern.test(suffix))) return `${title} (${match[1]})`;
  }

  const leadingYear = normalized.match(/^((?:18|19|20)\d{2})\s+(.+)$/);
  if (leadingYear && Number(leadingYear[1]) <= latestYear && !/^(?:a|an)\s+/i.test(leadingYear[2])) {
    const releaseMarker = leadingYear[2].search(releaseTokenPattern);
    const title = cleanTitle(stripEditionTokens(releaseMarker > 0 ? leadingYear[2].slice(0, releaseMarker) : leadingYear[2]));
    if (title.length >= 2) return `${title} (${leadingYear[1]})`;
  }

  const releaseMarker = normalized.search(releaseTokenPattern);
  const title = cleanTitle(stripEditionTokens(releaseMarker > 0 ? normalized.slice(0, releaseMarker) : normalized));
  return title.length >= 2 ? title : undefined;
}

export function inferMovieQuery(paths: string[], currentYear = new Date().getFullYear(), roles: Record<string, MovieVideoRole> = {}): string | undefined {
  const candidates = paths.map((path) => inferCandidate(path, currentYear + 1, roles[path])).filter((candidate): candidate is string => Boolean(candidate));
  if (!candidates.length) return undefined;
  const counts = new Map<string, { value: string; count: number }>();
  for (const candidate of candidates) {
    const key = candidate.toLocaleLowerCase();
    const current = counts.get(key);
    counts.set(key, { value: current?.value ?? candidate, count: (current?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((left, right) => right.count - left.count || right.value.length - left.value.length)[0]?.value;
}

export function inferMovieQueryCandidates(paths: string[], currentYear = new Date().getFullYear(), roles: Record<string, MovieVideoRole> = {}): string[] {
  const primary = inferMovieQuery(paths, currentYear, roles);
  if (!primary) return [];
  const year = primary.match(/ \((\d{4})\)$/);
  const title = year ? primary.slice(0, year.index) : primary;
  const strippedTitle = stripTrailingMovieEdition(title);
  if (!strippedTitle) return [primary];
  return [primary, `${strippedTitle}${year ? ` (${year[1]})` : ''}`];
}
