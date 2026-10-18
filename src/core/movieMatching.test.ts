import { describe, expect, it } from 'vitest';
import { chooseMovieMatch, confirmSuggestedMovie, manuallySelectMovie } from './movieMatching';

const movie = (id: string, name: string, year?: number, runtimeMinutes?: number) => ({ id, name, year, runtimeMinutes, overview: '' });

describe('movie batch matching', () => {
  it('accepts an exact title and year', () => {
    const match = chooseMovieMatch('/Mercury.mkv', 'Mercury Rising (1998)', [movie('8838', 'Mercury Rising', 1998)]);
    expect(match).toMatchObject({ status: 'confident', confidence: 1, movie: { id: '8838' }, reasons: ['title', 'year'] });
  });

  it('keeps duplicate title results for review when no year was inferred', () => {
    const match = chooseMovieMatch('/Crash.mkv', 'Crash', [movie('1', 'Crash', 1996), movie('2', 'Crash', 2004)]);
    expect(match).toMatchObject({ status: 'review', movie: { id: '1' } });
  });

  it('accepts a unique exact title without a year', () => {
    expect(chooseMovieMatch('/Arrival.mkv', 'Arrival', [movie('1', 'Arrival', 2016)])).toMatchObject({ status: 'confident', confidence: 0.9 });
  });

  it('uses file duration to disambiguate movies with the same title', () => {
    const match = chooseMovieMatch('/Crash.mkv', 'Crash', [movie('1', 'Crash', 1996, 100), movie('2', 'Crash', 2004, 112)], 111 * 60);
    expect(match).toMatchObject({ status: 'confident', confidence: .88, movie: { id: '2' }, reasons: ['title', 'runtime close'] });
  });

  it('keeps runtime as supporting evidence when the inferred year differs', () => {
    const match = chooseMovieMatch('/Movie.mkv', 'Movie (1999)', [movie('1', 'Movie', 2001, 90)], 90 * 60);
    expect(match).toMatchObject({ status: 'review', movie: { id: '1' } });
    expect(match.reasons).toEqual(['title', 'year differs', 'runtime close']);
  });

  it('marks empty results as unmatched', () => {
    expect(chooseMovieMatch('/Unknown.mkv', 'Unknown', [])).toMatchObject({ status: 'unmatched', confidence: 0 });
  });

  it('accepts a manual choice', () => {
    const match = chooseMovieMatch('/Crash.mkv', 'Crash', [movie('1', 'Crash', 1996), movie('2', 'Crash', 2004)]);
    expect(manuallySelectMovie(match, movie('2', 'Crash', 2004))).toMatchObject({ status: 'confident', movie: { id: '2' }, reasons: ['manually selected'] });
  });

  it('confirms the current suggested movie without replacing it', () => {
    const match = chooseMovieMatch('/Crash.mkv', 'Crash', [movie('1', 'Crash', 1996), movie('2', 'Crash', 2004)]);
    expect(confirmSuggestedMovie(match)).toMatchObject({ status: 'confident', movie: { id: '1' }, reasons: ['title', 'year unavailable', 'manually confirmed'] });
    expect(confirmSuggestedMovie(chooseMovieMatch('/Unknown.mkv', 'Unknown', []))).toMatchObject({ status: 'unmatched' });
  });
});
