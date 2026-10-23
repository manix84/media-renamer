import { describe, expect, it, vi } from 'vitest';
import { loadShowEpisodesWithFallback, type ShowEpisodeRequest } from './showEpisodeLoading';

const request: ShowEpisodeRequest = {
  agent: 'tvdb-aired',
  tmdbId: '272',
  tvdbId: '79396',
  seasons: [1],
};

describe('show episode loading', () => {
  it('falls back to TMDB when a stale TVDB series has no episode endpoint', async () => {
    const episode = { id: 'tmdb:1', season: 1, number: 1, title: 'Pilot' };
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('TVDB episodes for series 79396 were not found.'))
      .mockResolvedValueOnce([episode]);

    await expect(loadShowEpisodesWithFallback(request, load)).resolves.toEqual({
      episodes: [episode],
      agent: 'tmdb-aired',
      fallbackReason: 'TVDB episodes for series 79396 were not found.',
    });
    expect(load).toHaveBeenNthCalledWith(2, { ...request, agent: 'tmdb-aired', tvdbId: undefined });
  });

  it('does not hide authentication, network, or other TVDB failures', async () => {
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
