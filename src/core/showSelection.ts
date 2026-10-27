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

function normalizedShowTitle(value: string): string {
  return value.normalize('NFKD').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function automaticTvdbFallback(
  results: ShowSearchResult[],
  selectedName: string,
  selectedYear?: number,
): ShowSearchResult | undefined {
  if (results.length === 1) return results[0];
  if (results.length < 2) return undefined;
  const normalized = normalizedShowTitle(selectedName);
  const exact = results.filter((result) => normalizedShowTitle(result.name) === normalized);
  const exactYear = selectedYear === undefined ? [] : exact.filter((result) => result.year === selectedYear);
  if (exactYear.length === 1) return exactYear[0];
  if (exact.length === 1 && (selectedYear === undefined || exact[0].year === undefined)) return exact[0];
  return undefined;
}
