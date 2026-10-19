import { parseEpisodeCodes } from './episodeCode';
import type { ShowDetails, ShowSearchResult } from './types';

export function requestedEpisodeSeasons(paths: string[]): number[] {
  return [...new Set(paths.flatMap((filePath) => parseEpisodeCodes(filePath).map((episode) => episode.season)))].sort((left, right) => left - right);
}

export function seasonCompatibleShow(
  results: ShowSearchResult[],
  details: ShowDetails[],
  requestedSeasons: number[],
): ShowSearchResult | undefined {
  if (!results.length) return undefined;
  if (!requestedSeasons.length) return results[0];
  const detailsById = new Map(details.map((show) => [show.id, show]));
  return results.find((result) => {
    const candidate = detailsById.get(result.id);
    return candidate && requestedSeasons.every((season) => candidate.seasons.some((item) => item.number === season));
  }) ?? results[0];
}
