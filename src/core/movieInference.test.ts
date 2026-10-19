import { describe, expect, it } from 'vitest';
import { inferMovieQuery, inferMovieQueryCandidates } from './movieInference';
import { classifyMovieVideoRoles } from './movieVideoRole';

describe('movie-name inference', () => {
  it('extracts a dotted title and release year before release metadata', () => {
    expect(inferMovieQuery(['/movies/Mercury.Rising.1998.1080p.BluRay.x264.YIFY.mp4'], 2026)).toBe('Mercury Rising (1998)');
  });

  it('keeps a numbered sequel title separate from its release year', () => {
    expect(inferMovieQuery(['Hotel.Transylvania.2.2015.1080p.BluRay.DDP.5.1.x265-EDGE2020.mkv'], 2026))
      .toBe('Hotel Transylvania 2 (2015)');
  });

  it('keeps years that are part of a title and uses the later release year', () => {
    expect(inferMovieQuery(['/movies/2001.A.Space.Odyssey.1968.2160p.UHD.mkv'], 2026)).toBe('2001 A Space Odyssey (1968)');
    expect(inferMovieQuery(['/movies/Blade.Runner.2049.2017.1080p.mkv'], 2026)).toBe('Blade Runner 2049 (2017)');
  });

  it('supports collection filenames prefixed with their chronological release year', () => {
    expect(inferMovieQuery(['/movies/1985.The.Return.Of.The.Living.Dead.1920x1040.BDRip.x264.DTS-HD.MA.mkv'], 2026))
      .toBe('The Return Of The Living Dead (1985)');
    expect(inferMovieQuery(['/movies/1988.Return.Of.The.Living.Dead.II.1920x1036.BDRip.x264.DTS-HD.MA.mkv'], 2026))
      .toBe('Return Of The Living Dead II (1988)');
    expect(inferMovieQuery(['/movies/1993.Return.Of.The.Living.Dead.III.1920x1040.BDRip.x264.DTS-HD.MA.mkv'], 2026))
      .toBe('Return Of The Living Dead III (1993)');
  });

  it('does not reinterpret a leading numeric movie title as its release year', () => {
    expect(inferMovieQuery(['/movies/2001.A.Space.Odyssey.2160p.UHD.mkv'], 2026)).toBe('2001 A Space Odyssey');
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

  it('removes confirmed multipart and extra markers from movie searches', () => {
    const parts = ['/movies/Movie.2020.CD1.1080p.mkv', '/movies/Movie.2020.CD2.1080p.mkv'];
    const roles = classifyMovieVideoRoles(parts);
    expect(inferMovieQueryCandidates([parts[0]], 2026, roles)).toEqual(['Movie (2020)']);
    const trailer = '/movies/Movie.2020.trailer.1080p.mkv';
    expect(inferMovieQueryCandidates([trailer], 2026, classifyMovieVideoRoles([trailer]))).toEqual(['Movie (2020)']);
  });
});
