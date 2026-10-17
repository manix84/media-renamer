import type { Episode, FileMatch, MatchCandidate, SavedMatchDecision } from './types';

export function showDecisionId(show: { id: string; tvdbId?: string }): string {
  return show.tvdbId ? `tvdb:${show.tvdbId}` : `tmdb:${show.id}`;
}

export function matchDecisionFilenameKey(filePath: string): string {
  const filename = filePath.split(/[\\/]/).pop() ?? filePath;
  return filename
    .replace(/\.[^.]+$/, '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function saveMatchDecision(decisions: SavedMatchDecision[], showId: string, filePath: string, candidate: MatchCandidate): SavedMatchDecision[] {
  const filenameKey = matchDecisionFilenameKey(filePath);
  if (!filenameKey) return decisions;
  const next: SavedMatchDecision = {
    showId,
    filenameKey,
    episodeIds: (candidate.episodes ?? [candidate.episode]).map((episode) => episode.id),
    updatedAt: Date.now(),
  };
  return [...decisions.filter((item) => item.showId !== showId || item.filenameKey !== filenameKey), next]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 1000);
}

export function applySavedMatchDecision(match: FileMatch, episodes: Episode[], decisions: SavedMatchDecision[], showId: string): { match: FileMatch; conflict?: string } {
  const saved = decisions.find((item) => item.showId === showId && item.filenameKey === matchDecisionFilenameKey(match.path));
  if (!saved) return { match };
  const resolved = saved.episodeIds.map((id) => episodes.find((episode) => episode.id === id));
  if (!resolved.length || resolved.some((episode) => !episode)) {
    const conflict = 'A saved episode decision no longer exists in the current episode ordering.';
    return {
      match: {
        ...match,
        match: match.match ? { ...match.match, reasons: [...match.match.reasons, 'saved decision conflict'] } : undefined,
        status: match.match ? 'review' : 'unmatched',
      },
      conflict,
    };
  }
  const selected = resolved as Episode[];
  return {
    match: {
      ...match,
      match: { episode: selected[0], episodes: selected.length > 1 ? selected : undefined, score: 1, reasons: ['saved matching decision'] },
      status: 'confident',
    },
  };
}
