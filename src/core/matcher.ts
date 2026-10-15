import type { Episode, FileMatch, MatchCandidate } from './types';
import { parseReleaseTags } from './releaseTags';
import { parseEpisodeCode } from './episodeCode';

const stopWords = new Set(['a', 'an', 'and', 'of', 'the', 'to', 'in', 'part', 'episode']);

export function normalizeTitle(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .toLowerCase()
    .replace(/\b(?:s\d{1,2}e\d{1,3}|\d{1,2}x\d{1,3})\b/g, ' ')
    .replace(/\b(?:2160p|1080p|720p|576p|480p|web[ ._-]?dl|web[ ._-]?rip|blu[ ._-]?ray|b[dr]rip|hdtv|dvd[ ._-]?rip|x26[45]|h26[45]|hevc|av1|aac|ac3|eac3|dts)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token && !stopWords.has(token));
}

function titleSimilarity(filename: string, title: string, showTitle?: string): number {
  const showTokens = new Set(showTitle ? normalizeTitle(showTitle) : []);
  const left = new Set(normalizeTitle(filename).filter((token) => !showTokens.has(token)));
  const right = new Set(normalizeTitle(title).filter((token) => !showTokens.has(token)));
  if (!left.size || !right.size) return 0;
  const intersection = [...right].filter((token) => left.has(token)).length;
  const precision = intersection / left.size;
  const recall = intersection / right.size;
  // Extra filename tokens are expected (show, group and technical metadata),
  // so title recall matters much more than filename precision.
  return recall * 0.85 + precision * 0.15;
}

function numberedEpisode(filename: string): { season: number; episode: number } | undefined {
  const match = parseEpisodeCode(filename);
  return match ? { season: match.season, episode: match.episode } : undefined;
}

function durationEvidence(durationSeconds: number | undefined, runtimeMinutes: number | undefined): { score: number; reason?: string } {
  if (!durationSeconds || !runtimeMinutes) return { score: 0 };
  const expectedSeconds = runtimeMinutes * 60;
  const differenceSeconds = Math.abs(durationSeconds - expectedSeconds);
  if (differenceSeconds <= Math.max(120, expectedSeconds * .12)) return { score: .12, reason: `duration matches ${runtimeMinutes}m runtime` };
  if (differenceSeconds <= Math.max(300, expectedSeconds * .25)) return { score: .05, reason: `duration close to ${runtimeMinutes}m runtime` };
  return { score: 0 };
}

export function rankEpisodes(filename: string, episodes: Episode[], useTitle = true, showTitle?: string, durationSeconds?: number): MatchCandidate[] {
  const numbered = numberedEpisode(filename);
  return episodes
    .map((episode) => {
      const reasons: string[] = [];
      let score = 0;
      if (numbered?.season === episode.season && numbered.episode === episode.number) {
        score += 0.45;
        reasons.push('season and episode number');
      }
      if (useTitle) {
        const similarity = titleSimilarity(filename, episode.title, showTitle);
        score += similarity * 0.65;
        if (similarity >= 0.5) reasons.push(`title ${Math.round(similarity * 100)}%`);
      }
      const duration = durationEvidence(durationSeconds, episode.runtimeMinutes);
      score += duration.score;
      if (duration.reason) reasons.push(duration.reason);
      return { episode, score: Math.min(score, 1), reasons };
    })
    .filter(({ score }) => score > 0.12)
    .sort((a, b) => b.score - a.score);
}

export function matchFile(path: string, episodes: Episode[], useTitle = true, confidenceThreshold = 0.8, showTitle?: string, durationSeconds?: number): FileMatch {
  const filename = path.split(/[\\/]/).pop() ?? path;
  const alternatives = rankEpisodes(filename, episodes, useTitle, showTitle, durationSeconds);
  const match = alternatives[0];
  const threshold = Math.min(1, Math.max(0, confidenceThreshold));
  const status = !match || match.score < 0.34 ? 'unmatched' : match.score >= threshold ? 'confident' : 'review';
  return { path, filename, tags: parseReleaseTags(path), match, alternatives: alternatives.slice(1, 4), status };
}
