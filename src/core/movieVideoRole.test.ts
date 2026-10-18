import { describe, expect, it } from 'vitest';
import { appendMovieVideoSuffix, classifyMovieVideoRoles } from './movieVideoRole';

describe('movie video roles', () => {
  it('requires sibling evidence before treating numeric parts as multipart media', () => {
    const paths = ['/movies/Movie.2020.CD1.1080p.mkv', '/movies/Movie.2020.CD2.1080p.mkv'];
    expect(classifyMovieVideoRoles(paths)).toEqual({
      [paths[0]]: { kind: 'multipart', part: 1 },
      [paths[1]]: { kind: 'multipart', part: 2 },
    });
    expect(classifyMovieVideoRoles(['/movies/Harry.Potter.Part.1.2010.mkv'])).toEqual({ '/movies/Harry.Potter.Part.1.2010.mkv': { kind: 'main' } });
  });

  it('detects samples and common Plex extra types', () => {
    const paths = ['/movies/Movie/sample.mkv', '/movies/Movie-trailer.mp4', '/movies/Featurettes/Making Of.mkv'];
    expect(classifyMovieVideoRoles(paths)).toEqual({
      [paths[0]]: { kind: 'sample' },
      [paths[1]]: { kind: 'extra', extraType: 'trailer' },
      [paths[2]]: { kind: 'extra', extraType: 'featurette' },
    });
  });

  it('adds Plex-compatible suffixes before the extension', () => {
    expect(appendMovieVideoSuffix('Movie (2020).mkv', { kind: 'multipart', part: 2 })).toBe('Movie (2020) - cd2.mkv');
    expect(appendMovieVideoSuffix('Movie (2020).mkv', { kind: 'extra', extraType: 'trailer' })).toBe('Movie (2020)-trailer.mkv');
  });
});
