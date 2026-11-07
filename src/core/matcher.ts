import type { Episode, FileMatch, MatchCandidate } from './types';
import { parseReleaseTags } from './releaseTags';
import { parseEpisodeCodes, parseFolderEpisode, parseSpecialEpisode, parseStandaloneEpisode } from './episodeCode';

const stopWords = new Set(['a', 'an', 'and', 'of', 'the', 'to', 'in', 'part', 'episode']);

export function normalizeTitle(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .toLowerCase()
    .replace(/\b(?:s\d{1,2}(?:e|[ ._-])\d{1,3}|\d{1,2}x\d{1,3})(?:v\d+)?\b/g, ' ')
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

function hasEpisodeTitleEvidence(filename: string, showTitle: string | undefined, episodeNumbers: number[]): boolean {
  const leaf = (filename.split(/[\\/]/).pop() ?? filename)
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/\[[^\]]*\]|\([^)]*(?:\b(?:2160p|1080p|720p|576p|480p|web|blu[ ._-]?ray|dvd|x26[45]|h26[45]|hevc|av1|aac|ac3|eac3|dts)\b)[^)]*\)/gi, ' ');
  const showTokens = new Set(showTitle ? normalizeTitle(showTitle) : []);
  const release = parseReleaseTags(filename);
  const releaseTokens = new Set(normalizeTitle([
    release.group,
    release.source,
    release.resolution,
    release.videoCodec,
    release.audioCodec,
    release.channels,
    ...release.flags,
  ].filter(Boolean).join(' ')));
  const placeholderTokens = new Set(['unknown', 'untitled', 'tba', 'tbd']);
  const numberedTokens = new Set(episodeNumbers.flatMap((number) => [String(number), String(number).padStart(2, '0'), String(number).padStart(3, '0')]));
  return normalizeTitle(leaf).some((token) => !showTokens.has(token) && !releaseTokens.has(token) && !placeholderTokens.has(token) && !numberedTokens.has(token) && !/^20\d{2}$/.test(token));
}

function cumulativeSeasonEpisodes(season: number, numbers: number[], episodes: Episode[]): Episode[] | undefined {
  const seasonEpisodes = episodes.filter((episode) => episode.season === season);
  const maximumSeasonEpisode = Math.max(0, ...seasonEpisodes.map((episode) => episode.number));
  if (!seasonEpisodes.length || numbers.some((number) => number <= maximumSeasonEpisode)) return undefined;

  const regularEpisodes = episodes
    .filter((episode) => episode.season > 0)
    .sort((left, right) => left.season - right.season || left.number - right.number);
  const resolved = numbers.map((number) => {
    const providerMatches = regularEpisodes.filter((episode) => episode.absoluteNumber === number);
    return providerMatches.length === 1 ? providerMatches[0] : regularEpisodes[number - 1];
  });
  return resolved.every((episode): episode is Episode => Boolean(episode) && episode.season === season) ? resolved : undefined;
}

function numberedEpisodes(filename: string, episodes: Episode[], filePath = filename): { season: number; episodeNumbers: number[]; evidence: 'season' | 'folder' | 'special' | 'absolute' | 'sole-season' | 'cumulative' } | undefined {
  const matches = parseEpisodeCodes(filename);
  if (matches.length) {
    const season = matches[0].season;
    const numbers = matches.map((match) => match.episode);
    const exact = numbers.every((number) => episodes.some((episode) => episode.season === season && episode.number === number));
    if (exact) return { season, episodeNumbers: numbers, evidence: 'season' };
    const cumulative = cumulativeSeasonEpisodes(season, numbers, episodes);
    if (cumulative) return { season, episodeNumbers: cumulative.map((episode) => episode.number), evidence: 'cumulative' };
    return { season, episodeNumbers: numbers, evidence: 'season' };
  }
  const special = parseSpecialEpisode(filename);
  if (special) return { season: 0, episodeNumbers: [special.episode], evidence: 'special' };
  const folder = parseFolderEpisode(filePath);
  if (folder) return { season: folder.season, episodeNumbers: [folder.episode], evidence: 'folder' };
  const standalone = parseStandaloneEpisode(filename);
  if (!standalone) return undefined;
  const absoluteMatches = episodes.filter((episode) => episode.absoluteNumber === standalone.episode);
  if (absoluteMatches.length === 1) return { season: absoluteMatches[0].season, episodeNumbers: [absoluteMatches[0].number], evidence: 'absolute' };
  const matchingSeasons = [...new Set(episodes.filter((episode) => episode.number === standalone.episode).map((episode) => episode.season))];
  return matchingSeasons.length === 1 ? { season: matchingSeasons[0], episodeNumbers: [standalone.episode], evidence: 'sole-season' } : undefined;
}

function durationEvidence(durationSeconds: number | undefined, runtimeMinutes: number | undefined): { score: number; reason?: string } {
  if (!durationSeconds || !runtimeMinutes) return { score: 0 };
  const expectedSeconds = runtimeMinutes * 60;
  const differenceSeconds = Math.abs(durationSeconds - expectedSeconds);
  if (differenceSeconds <= Math.max(120, expectedSeconds * .12)) return { score: .12, reason: `duration matches ${runtimeMinutes}m runtime` };
  if (differenceSeconds <= Math.max(300, expectedSeconds * .25)) return { score: .05, reason: `duration close to ${runtimeMinutes}m runtime` };
  return { score: 0 };
}

export function rankEpisodes(filename: string, episodes: Episode[], useTitle = true, showTitle?: string, durationSeconds?: number, filePath = filename, embeddedTitle?: string): MatchCandidate[] {
  const numbered = numberedEpisodes(filename, episodes, filePath);
  const numberedMatches = numbered?.episodeNumbers.map((number) => episodes.find((episode) => episode.season === numbered.season && episode.number === number));
  const completeNumberedMatch = numberedMatches?.every((episode): episode is Episode => Boolean(episode)) ? numberedMatches as Episode[] : undefined;
  const numberOnlyEvidence = Boolean(numbered && completeNumberedMatch && ['season', 'folder', 'special', 'cumulative'].includes(numbered.evidence) && !hasEpisodeTitleEvidence(filename, showTitle, numbered.episodeNumbers));
  return episodes
    .map((episode) => {
      const reasons: string[] = [];
      let score = 0;
      if (numbered?.season === episode.season && numbered.episodeNumbers[0] === episode.number && completeNumberedMatch) {
        score += 0.45;
        reasons.push(numbered.evidence === 'season'
          ? completeNumberedMatch.length > 1 ? `${completeNumberedMatch.length} episode numbers` : 'season and episode number'
          : numbered.evidence === 'folder' ? 'season folder and episode number'
          : numbered.evidence === 'special' ? 'special episode number'
            : numbered.evidence === 'cumulative' ? 'cumulative episode number mapped into stated season'
            : numbered.evidence === 'absolute' ? 'absolute episode number'
              : 'episode number in the only matching season');
        if (numberOnlyEvidence) {
          score += 0.4;
          reasons.push('exact numbering with no conflicting episode title');
        }
      }
      if (useTitle) {
        const titleScores = [episode.title, ...(episode.alternateTitles ?? [])].map((title) => ({ title, score: titleSimilarity(filename, title, showTitle) }));
        const bestTitle = titleScores.sort((left, right) => right.score - left.score)[0];
        const similarity = bestTitle?.score ?? 0;
        score += similarity * 0.65;
        if (similarity >= 0.5) reasons.push(`${bestTitle?.title === episode.title ? 'title' : 'alternate title'} ${Math.round(similarity * 100)}%`);
        const embeddedSimilarity = embeddedTitle ? Math.max(...[episode.title, ...(episode.alternateTitles ?? [])].map((title) => titleSimilarity(embeddedTitle, title, showTitle))) : 0;
        score += embeddedSimilarity * 0.3;
        if (embeddedSimilarity >= 0.5) reasons.push(`embedded title ${Math.round(embeddedSimilarity * 100)}%`);
      }
      const combinedRuntime = completeNumberedMatch?.[0].id === episode.id && completeNumberedMatch.every((item) => item.runtimeMinutes)
        ? completeNumberedMatch.reduce((total, item) => total + (item.runtimeMinutes ?? 0), 0)
        : episode.runtimeMinutes;
      const duration = durationEvidence(durationSeconds, combinedRuntime);
      score += duration.score;
      if (duration.reason) reasons.push(duration.reason);
      return { episode, episodes: completeNumberedMatch?.[0].id === episode.id && completeNumberedMatch.length > 1 ? completeNumberedMatch : undefined, score: Math.min(score, 1), reasons };
    })
    .filter(({ score }) => score > 0.12)
    .sort((a, b) => b.score - a.score);
}

export function matchFile(path: string, episodes: Episode[], useTitle = true, confidenceThreshold = 0.8, showTitle?: string, durationSeconds?: number, embeddedTitle?: string): FileMatch {
  const filename = path.split(/[\\/]/).pop() ?? path;
  const alternatives = rankEpisodes(filename, episodes, useTitle, showTitle, durationSeconds, path, embeddedTitle);
  const match = alternatives[0];
  const threshold = Math.min(1, Math.max(0, confidenceThreshold));
  const status = !match || match.score < 0.34 ? 'unmatched' : match.score >= threshold ? 'confident' : 'review';
  return { path, filename, tags: parseReleaseTags(path), match, alternatives: alternatives.slice(1, 4), status };
}
