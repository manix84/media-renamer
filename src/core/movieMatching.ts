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

export function chooseMovieMatch(path: string, query: string, candidates: MovieSearchResult[]): MovieFileMatch {
  const dated = query.match(/^(.*\S)\s+\(((?:18|19|20)\d{2})\)$/);
  const expectedTitle = normalizedTitle(dated?.[1] ?? query);
  const expectedYear = dated ? Number(dated[2]) : undefined;
  const ranked = candidates.slice().sort((left, right) => {
    const score = (movie: MovieSearchResult) =>
      Number(normalizedTitle(movie.name) === expectedTitle) * 4
      + Number(expectedYear !== undefined && movie.year === expectedYear) * 2;
    return score(right) - score(left);
  });
  const selected = ranked[0];
  if (!selected) return { path, query, candidates: [], status: 'unmatched', confidence: 0, reasons: ['no TMDB results'] };

  const exactTitle = normalizedTitle(selected.name) === expectedTitle;
  const matchingYear = expectedYear !== undefined && selected.year === expectedYear;
  const exactTitleCount = ranked.filter((candidate) => normalizedTitle(candidate.name) === expectedTitle).length;
  if (exactTitle && matchingYear) {
    return { path, query, movie: selected, candidates: ranked, status: 'confident', confidence: 1, reasons: ['title', 'year'] };
  }
  if (exactTitle && expectedYear === undefined && exactTitleCount === 1) {
    return { path, query, movie: selected, candidates: ranked, status: 'confident', confidence: 0.9, reasons: ['unique title'] };
  }
  return {
    path,
    query,
    movie: selected,
    candidates: ranked,
    status: 'review',
    confidence: exactTitle ? 0.72 : matchingYear ? 0.6 : 0.45,
    reasons: [exactTitle ? 'title' : 'closest title', matchingYear ? 'year' : expectedYear === undefined ? 'year unavailable' : 'year differs'],
  };
}

export function manuallySelectMovie(match: MovieFileMatch, movie: MovieSearchResult): MovieFileMatch {
  return { ...match, movie, candidates: [movie, ...match.candidates.filter((candidate) => candidate.id !== movie.id)], status: 'confident', confidence: 1, reasons: ['manually selected'], error: undefined };
}
