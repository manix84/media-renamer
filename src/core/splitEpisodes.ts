import type { Episode, MatchCandidate } from './types';

const trailingPartPattern = /\s*(?:\((?:part\s*)?(\d+|[ivx]+)\)|\[(?:part\s*)?(\d+|[ivx]+)\]|(?:[-–—:]\s*)?part\s+(\d+|[ivx]+))\s*$/i;

function splitTitle(title: string): { title: string; part: string } | undefined {
  const match = trailingPartPattern.exec(title);
  if (!match) return undefined;
  const cleaned = title.slice(0, match.index).trim();
  const part = (match[1] ?? match[2] ?? match[3])?.toLocaleLowerCase();
  return cleaned && part ? { title: cleaned, part } : undefined;
}

export function sharedSplitEpisodeTitle(episodes: Episode[]): string | undefined {
  if (episodes.length < 2) return undefined;
  const parsed = episodes.map((episode) => splitTitle(episode.title));
  if (parsed.some((item) => !item)) return undefined;
  const parts = parsed as Array<{ title: string; part: string }>;
  const title = parts[0].title;
  if (!parts.every((item) => item.title.localeCompare(title, undefined, { sensitivity: 'base' }) === 0)) return undefined;
  if (new Set(parts.map((item) => item.part)).size !== parts.length) return undefined;
  const ordered = [...episodes].sort((left, right) => left.number - right.number);
  if (!ordered.every((episode, index) => episode.season === ordered[0].season && (index === 0 || episode.number === ordered[index - 1].number + 1))) return undefined;
  return title;
}

export function episodesForFilename(selected: Episode[], catalog: Episode[]): Episode[] {
  const sharedTitle = sharedSplitEpisodeTitle(selected);
  if (sharedTitle) return [{ ...selected[0], title: sharedTitle }];
  if (selected.length !== 1) return selected;
  const parsed = splitTitle(selected[0].title);
  if (!parsed) return selected;
  const sibling = catalog.find((episode) => episode.id !== selected[0].id
    && episode.season === selected[0].season
    && Math.abs(episode.number - selected[0].number) === 1
    && splitTitle(episode.title)?.title.localeCompare(parsed.title, undefined, { sensitivity: 'base' }) === 0);
  return sibling ? [{ ...selected[0], title: parsed.title }] : selected;
}

export function splitEpisodeReviewCandidates(candidate: MatchCandidate): MatchCandidate[] {
  const selected = candidate.episodes?.length ? candidate.episodes : [candidate.episode];
  const sharedTitle = sharedSplitEpisodeTitle(selected);
  if (!sharedTitle) return [candidate];
  return [
    ...selected.map((episode) => ({ episode: { ...episode, title: sharedTitle }, score: candidate.score, reasons: [...candidate.reasons, 'single episode from split-title pair'] })),
    candidate,
  ];
}

export function displayEpisodeTitle(candidate: MatchCandidate): string {
  const selected = candidate.episodes?.length ? candidate.episodes : [candidate.episode];
  return sharedSplitEpisodeTitle(selected) ?? selected.map((episode) => episode.title).join(', ');
}
