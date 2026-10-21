import { matchFile } from './matcher';
import type { Episode, FileMatch } from './types';

export function matchFiles(
  paths: string[],
  episodes: Episode[],
  titleMatching: boolean,
  onProgress: (completed: number, total: number) => void,
  confidenceThreshold = 0.8,
  showTitle?: string,
  durationsByPath: Record<string, number | undefined> = {},
  embeddedTitlesByPath: Record<string, string | undefined> = {},
): FileMatch[] {
  const matches = paths.map((path, index) => {
    const match = matchFile(path, episodes, titleMatching, confidenceThreshold, showTitle, durationsByPath[path], embeddedTitlesByPath[path]);
    onProgress(index + 1, paths.length);
    return match;
  });
  const ordered = [...episodes].sort((left, right) => left.season - right.season || left.number - right.number);
  const episodeIndex = new Map(ordered.map((episode, index) => [episode.id, index]));
  const lexicalIndexes = paths.map((path, index) => ({ path, index })).sort((left, right) => left.path.localeCompare(right.path, undefined, { numeric: true })).map(({ index }) => index);
  const hasNumberEvidence = (match: FileMatch): boolean => Boolean(match.match?.reasons.some((reason) => /episode number|special episode|absolute episode|season folder/.test(reason)));
  for (let position = 1; position < lexicalIndexes.length - 1; position += 1) {
    const index = lexicalIndexes[position];
    const current = matches[index];
    if (current.status === 'confident') continue;
    const previousMatch = matches[lexicalIndexes[position - 1]];
    const nextMatch = matches[lexicalIndexes[position + 1]];
    if (!hasNumberEvidence(previousMatch) || !hasNumberEvidence(nextMatch)) continue;
    const previous = previousMatch.match?.episode;
    const next = nextMatch.match?.episode;
    const previousIndex = previous ? episodeIndex.get(previous.id) : undefined;
    const nextIndex = next ? episodeIndex.get(next.id) : undefined;
    if (previousIndex === undefined || nextIndex !== previousIndex + 2) continue;
    const episode = ordered[previousIndex + 1];
    const candidate = { episode, score: Math.max(current.match?.score ?? 0, .62), reasons: [...(current.match?.reasons ?? []), 'adjacent files bracket this episode'] };
    const alternatives = [current.match, ...current.alternatives].flatMap((item) => item && item.episode.id !== episode.id ? [item] : []).slice(0, 3);
    matches[index] = { ...current, match: candidate, alternatives, status: candidate.score >= confidenceThreshold ? 'confident' : 'review' };
  }
  return matches;
}
