import { describe, expect, it } from 'vitest';
import { mergeEpisodeArtwork } from './episodeMetadata';

describe('episode metadata enrichment', () => {
  it('adds TMDB artwork and missing descriptions without replacing TVDB identity data', () => {
    const tvdb = [{ id: 'tvdb-1', season: 2, number: 1, title: 'TVDB title' }, { id: 'tvdb-2', season: 2, number: 2, title: 'Keep', imageUrl: 'https://artworks.thetvdb.com/keep.jpg', overview: 'TVDB plot' }];
    const tmdb = [{ id: 'tmdb-1', season: 2, number: 1, title: 'TMDB title', imageUrl: 'https://image.tmdb.org/still.jpg', overview: 'TMDB plot' }, { id: 'tmdb-2', season: 2, number: 2, title: 'Other', imageUrl: 'https://image.tmdb.org/replace.jpg', overview: 'Replace plot' }];

    expect(mergeEpisodeArtwork(tvdb, tmdb)).toEqual([
      { ...tvdb[0], imageUrl: 'https://image.tmdb.org/still.jpg', overview: 'TMDB plot' },
      tvdb[1],
    ]);
  });

  it('does not merge artwork from a different episode number', () => {
    const tvdb = [{ id: 'tvdb-1', season: 1, number: 1, title: 'Pilot' }];
    const tmdb = [{ id: 'tmdb-2', season: 1, number: 2, title: 'Second', imageUrl: 'https://image.tmdb.org/second.jpg' }];
    expect(mergeEpisodeArtwork(tvdb, tmdb)).toEqual(tvdb);
  });
});
