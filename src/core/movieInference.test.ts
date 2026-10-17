import { describe, expect, it } from 'vitest';
import { inferMovieQuery, inferMovieQueryCandidates } from './movieInference';

describe('movie-name inference', () => {
  it('extracts a dotted title and release year before release metadata', () => {
    expect(inferMovieQuery(['/movies/Mercury.Rising.1998.1080p.BluRay.x264.YIFY.mp4'], 2026)).toBe('Mercury Rising (1998)');
  });

  it('keeps years that are part of a title and uses the later release year', () => {
    expect(inferMovieQuery(['/movies/2001.A.Space.Odyssey.1968.2160p.UHD.mkv'], 2026)).toBe('2001 A Space Odyssey (1968)');
    expect(inferMovieQuery(['/movies/Blade.Runner.2049.2017.1080p.mkv'], 2026)).toBe('Blade Runner 2049 (2017)');
  });

  it('does not mistake a future number in a title for a release year', () => {
    expect(inferMovieQuery(['/movies/Blade.Runner.2049.mkv'], 2026)).toBe('Blade Runner 2049');
  });

  it('can infer a title when no year is present', () => {
    expect(inferMovieQuery(['/movies/Arrival.1080p.WEB-DL.x265.mkv'], 2026)).toBe('Arrival');
  });

  it('keeps edition evidence out of the metadata search query', () => {
    expect(inferMovieQuery(['/movies/Blade Runner (1982) {edition-Final Cut}.mkv'], 2026)).toBe('Blade Runner (1982)');
  });

  it('retries a recognized trailing edition without weakening the literal first search', () => {
    expect(inferMovieQueryCandidates(['/movies/Total.Recall.Mind.Bending.Edition.1990.1080p.BluRay.x264.YIFY.mp4'], 2026))
      .toEqual(['Total Recall Mind Bending Edition (1990)', 'Total Recall (1990)']);
    expect(inferMovieQueryCandidates(['/movies/Piranha.3D.2010.1080p.mkv'], 2026))
      .toEqual(['Piranha 3D (2010)']);
    expect(inferMovieQueryCandidates(['/movies/Uncut.Gems.2019.1080p.mkv'], 2026))
      .toEqual(['Uncut Gems (2019)']);
  });

  it('uses the most common candidate for a multi-file import', () => {
    expect(inferMovieQuery([
      '/movies/Main.Movie.2020.Disc.1.1080p.mkv',
      '/movies/Main.Movie.2020.Disc.2.1080p.mkv',
      '/movies/Other.Movie.2019.1080p.mkv',
    ], 2026)).toBe('Main Movie (2020)');
  });
});
