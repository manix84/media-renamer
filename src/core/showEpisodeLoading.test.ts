import { describe, expect, it, vi } from 'vitest';
import { loadShowEpisodesWithFallback, type ShowEpisodeRequest } from './showEpisodeLoading';

const request: ShowEpisodeRequest = {
  agent: 'tvdb-aired',
  tmdbId: '272',
  tvdbId: '79396',
  seasons: [1],
};

describe('show episode loading', () => {
  it('keeps the TVDB S00E14 title instead of substituting the TMDB special', async () => {
    const episode = { id: 'tvdb:1', season: 0, number: 14, title: 'The Movie' };
    const load = vi.fn().mockResolvedValue([episode]);
    await expect(loadShowEpisodesWithFallback(request, load)).resolves.toEqual({ episodes: [episode], agent: 'tvdb-aired', tvdbId: '79396' });
    expect(load).toHaveBeenCalledWith(request);
  });

  it('does not silently substitute TMDB when TVDB fails', async () => {
    const load = vi.fn().mockRejectedValue(new Error('TVDB episode request failed (503).'));
    await expect(loadShowEpisodesWithFallback(request, load)).rejects.toThrow('TVDB episode request failed (503).');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not retry a failed TMDB request', async () => {
    const load = vi.fn().mockRejectedValue(new Error('TMDB request failed (404).'));
    await expect(loadShowEpisodesWithFallback({ ...request, agent: 'tmdb-aired' }, load)).rejects.toThrow('TMDB request failed (404).');
    expect(load).toHaveBeenCalledTimes(1);
  });
});
