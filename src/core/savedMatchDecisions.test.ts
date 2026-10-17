import { describe, expect, it, vi } from 'vitest';
import { applySavedMatchDecision, matchDecisionFilenameKey, saveMatchDecision, showDecisionId } from './savedMatchDecisions';
import type { Episode, FileMatch, MatchCandidate } from './types';

const episode: Episode = { id: 'episode-3', season: 2, number: 3, title: 'Third' };
const candidate: MatchCandidate = { episode, score: .5, reasons: ['manual selection'] };
const unmatched: FileMatch = { path: '/tv/Show/Season 2/03.MKV', filename: '03.MKV', tags: { source: 'Unknown', flags: [] }, alternatives: [], status: 'unmatched' };

describe('saved matching decisions', () => {
  it('normalizes path separators, punctuation, case, and extensions', () => {
    expect(matchDecisionFilenameKey('C:\\TV\\Show\\Episode_03.MKV')).toBe('episode 03');
    expect(matchDecisionFilenameKey('/tv/show/episode.03.mp4')).toBe('episode 03');
  });

  it('prefers a TVDB identity and falls back to TMDB', () => {
    expect(showDecisionId({ id: '22', tvdbId: '11' })).toBe('tvdb:11');
    expect(showDecisionId({ id: '22' })).toBe('tmdb:22');
  });

  it('stores and reapplies the latest decision for a show and filename', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    const decisions = saveMatchDecision([], 'tvdb:11', unmatched.path, candidate);
    expect(decisions).toEqual([{ showId: 'tvdb:11', filenameKey: '03', episodeIds: ['episode-3'], updatedAt: 1234 }]);
    const applied = applySavedMatchDecision(unmatched, [episode], decisions, 'tvdb:11');
    expect(applied.match.status).toBe('confident');
    expect(applied.match.match?.episode).toEqual(episode);
    expect(applied.match.match?.reasons).toEqual(['saved matching decision']);
    vi.restoreAllMocks();
  });

  it('does not apply another show decision or a stale episode ID', () => {
    const decisions = [{ showId: 'tvdb:11', filenameKey: '03', episodeIds: ['missing'], updatedAt: 1 }];
    expect(applySavedMatchDecision(unmatched, [episode], decisions, 'tvdb:12')).toEqual({ match: unmatched });
    const conflict = applySavedMatchDecision({ ...unmatched, match: candidate, status: 'confident' }, [episode], decisions, 'tvdb:11');
    expect(conflict.conflict).toContain('no longer exists');
    expect(conflict.match.status).toBe('review');
    expect(conflict.match.match?.reasons).toContain('saved decision conflict');
  });
});
