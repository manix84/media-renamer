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
  if (selected.length === 1) return [candidate];
  const sharedTitle = sharedSplitEpisodeTitle(selected);
  return selected.map((episode) => ({
    episode: sharedTitle ? { ...episode, title: sharedTitle } : episode,
    score: candidate.score,
    reasons: [...candidate.reasons, 'single episode from grouped match'],
  }));
}

export function displayEpisodeTitle(candidate: MatchCandidate): string {
  const selected = candidate.episodes?.length ? candidate.episodes : [candidate.episode];
  return sharedSplitEpisodeTitle(selected) ?? selected.map((episode) => episode.title).join(', ');
}

export function searchEpisodeReviewCandidates(episodes: Episode[], query: string): MatchCandidate[] {
  const search = query.trim().toLocaleLowerCase();
  if (!search) return [];
  return episodes
    .filter((episode) => `s${String(episode.season).padStart(2, '0')}e${String(episode.number).padStart(2, '0')} ${episode.title}`.toLocaleLowerCase().includes(search))
    .slice(0, 100)
    .map((episode) => ({ episode, score: 1, reasons: ['manually selected'] }));
}

export function updateEpisodeReviewSelection(
  current: MatchCandidate | undefined,
  visible: MatchCandidate[],
  clickedId: string,
  options: { toggle: boolean; range: boolean; anchorId?: string },
): { candidate?: MatchCandidate; anchorId: string } {
  const visibleEpisodes = visible.map(({ episode }) => episode);
  const clickedIndex = visibleEpisodes.findIndex(({ id }) => id === clickedId);
  if (clickedIndex < 0) return { candidate: current, anchorId: options.anchorId ?? clickedId };
  const currentIds = new Set(current ? (current.episodes?.length ? current.episodes : [current.episode]).map(({ id }) => id) : []);
  let selectedIds: Set<string>;
  if (options.range) {
    const anchorIndex = Math.max(0, visibleEpisodes.findIndex(({ id }) => id === options.anchorId));
    const rangeIds = visibleEpisodes.slice(Math.min(anchorIndex, clickedIndex), Math.max(anchorIndex, clickedIndex) + 1).map(({ id }) => id);
    selectedIds = options.toggle ? new Set([...currentIds, ...rangeIds]) : new Set(rangeIds);
  } else if (options.toggle) {
    selectedIds = new Set(currentIds);
    if (selectedIds.has(clickedId)) selectedIds.delete(clickedId);
    else selectedIds.add(clickedId);
  } else selectedIds = new Set([clickedId]);
  const selected = visibleEpisodes.filter(({ id }) => selectedIds.has(id));
  return {
    candidate: selected.length ? {
      episode: selected[0],
      episodes: selected.length > 1 ? selected : undefined,
      score: 1,
      reasons: ['manually selected'],
    } : undefined,
    anchorId: options.range && options.anchorId ? options.anchorId : clickedId,
  };
}
