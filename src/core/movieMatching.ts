import type { MovieSearchResult } from './types';

export type MovieMatchStatus = 'detecting' | 'confident' | 'review' | 'unmatched' | 'error';

export interface MovieFileMatch {
  path: string;
  query: string;
  movie?: MovieSearchResult;
  candidates: MovieSearchResult[];
  status: MovieMatchStatus;
  confidence: number;
  reasons: string[];
  error?: string;
}

function normalizedTitle(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function runtimeCloseness(movie: MovieSearchResult, durationSeconds?: number): 'close' | 'near' | undefined {
  if (!durationSeconds || !movie.runtimeMinutes) return undefined;
  const differenceMinutes = Math.abs(durationSeconds / 60 - movie.runtimeMinutes);
  if (differenceMinutes <= Math.max(5, movie.runtimeMinutes * .08)) return 'close';
  if (differenceMinutes <= Math.max(15, movie.runtimeMinutes * .15)) return 'near';
  return undefined;
}

export function chooseMovieMatch(path: string, query: string, candidates: MovieSearchResult[], durationSeconds?: number): MovieFileMatch {
  const dated = query.match(/^(.*\S)\s+\(((?:18|19|20)\d{2})\)$/);
  const expectedTitle = normalizedTitle(dated?.[1] ?? query);
  const expectedYear = dated ? Number(dated[2]) : undefined;
  const ranked = candidates.slice().sort((left, right) => {
    const score = (movie: MovieSearchResult) =>
      Number(normalizedTitle(movie.name) === expectedTitle) * 4
      + Number(expectedYear !== undefined && movie.year === expectedYear) * 2
      + (runtimeCloseness(movie, durationSeconds) === 'close' ? 1.5 : runtimeCloseness(movie, durationSeconds) === 'near' ? .5 : 0);
    return score(right) - score(left);
  });
  const selected = ranked[0];
  if (!selected) return { path, query, candidates: [], status: 'unmatched', confidence: 0, reasons: ['no TMDB results'] };

  const exactTitle = normalizedTitle(selected.name) === expectedTitle;
  const matchingYear = expectedYear !== undefined && selected.year === expectedYear;
  const exactTitleCount = ranked.filter((candidate) => normalizedTitle(candidate.name) === expectedTitle).length;
  const runtimeEvidence = runtimeCloseness(selected, durationSeconds);
  const closeRuntimeCount = ranked.filter((candidate) => normalizedTitle(candidate.name) === expectedTitle && runtimeCloseness(candidate, durationSeconds) === 'close').length;
  if (exactTitle && matchingYear) {
    return { path, query, movie: selected, candidates: ranked, status: 'confident', confidence: 1, reasons: ['title', 'year', ...(runtimeEvidence ? [`runtime ${runtimeEvidence}`] : [])] };
  }
  if (exactTitle && expectedYear === undefined && exactTitleCount === 1) {
    return { path, query, movie: selected, candidates: ranked, status: 'confident', confidence: 0.9, reasons: ['unique title', ...(runtimeEvidence ? [`runtime ${runtimeEvidence}`] : [])] };
  }
  if (exactTitle && expectedYear === undefined && runtimeEvidence === 'close' && closeRuntimeCount === 1) {
    return { path, query, movie: selected, candidates: ranked, status: 'confident', confidence: .88, reasons: ['title', 'runtime close'] };
  }
  return {
    path,
    query,
    movie: selected,
    candidates: ranked,
    status: 'review',
    confidence: Math.min(.84, (exactTitle ? 0.72 : matchingYear ? 0.6 : 0.45) + (runtimeEvidence === 'close' ? .1 : runtimeEvidence === 'near' ? .04 : 0)),
    reasons: [exactTitle ? 'title' : 'closest title', matchingYear ? 'year' : expectedYear === undefined ? 'year unavailable' : 'year differs', ...(runtimeEvidence ? [`runtime ${runtimeEvidence}`] : [])],
  };
}

export function manuallySelectMovie(match: MovieFileMatch, movie: MovieSearchResult): MovieFileMatch {
  return { ...match, movie, candidates: [movie, ...match.candidates.filter((candidate) => candidate.id !== movie.id)], status: 'confident', confidence: 1, reasons: ['manually selected'], error: undefined };
}

export function confirmSuggestedMovie(match: MovieFileMatch): MovieFileMatch {
  if (!match.movie || match.status !== 'review') return match;
  return { ...match, status: 'confident', reasons: [...match.reasons, 'manually confirmed'], error: undefined };
}
