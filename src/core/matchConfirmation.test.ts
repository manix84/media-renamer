import { describe, expect, it } from 'vitest';
import { movieMatchConfirmationState, tvMatchConfirmationState } from './matchConfirmation';
import type { FileMatch } from './types';
import type { MovieFileMatch } from './movieMatching';

const episodeSuggestion: FileMatch = {
  path: '/show.mkv', filename: 'show.mkv', tags: { source: 'Unknown', flags: [] }, alternatives: [], status: 'review',
  match: { episode: { id: 'episode', season: 1, number: 2, title: 'Second' }, score: 0.6, reasons: ['episode number'] },
};

const movieSuggestion: MovieFileMatch = {
  path: '/movie.mkv', query: 'Movie', candidates: [], status: 'review', confidence: 0.6, reasons: ['title'],
  movie: { id: '1', name: 'Movie', year: 2026, overview: '' },
};

describe('match confirmation state', () => {
  it('separates TV suggestions from resolved and unmatched episodes', () => {
    expect(tvMatchConfirmationState(episodeSuggestion, false).kind).toBe('suggestion');
    expect(tvMatchConfirmationState(episodeSuggestion, true).kind).toBe('resolved');
    expect(tvMatchConfirmationState({ ...episodeSuggestion, status: 'confident' }, false).kind).toBe('resolved');
    expect(tvMatchConfirmationState({ ...episodeSuggestion, match: undefined, status: 'unmatched' }, false)).toEqual({ kind: 'blocked', reason: 'No episode suggestion is available.' });
  });

  it('separates movie suggestions, detection, and TV-deferred files', () => {
    expect(movieMatchConfirmationState(movieSuggestion).kind).toBe('suggestion');
    expect(movieMatchConfirmationState({ ...movieSuggestion, status: 'confident' }).kind).toBe('resolved');
    expect(movieMatchConfirmationState({ ...movieSuggestion, movie: undefined, status: 'detecting' }).reason).toBe('Detection is still running.');
    expect(movieMatchConfirmationState(movieSuggestion, true).reason).toContain('TV episode numbering');
  });
});
