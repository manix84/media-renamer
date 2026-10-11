import { describe, expect, it } from 'vitest';
import { inferShowQuery } from './showInference';

describe('show-name inference', () => {
  it('extracts a show title from common numbered episode names', () => {
    expect(inferShowQuery(['/media/Archive.X.Unexplained.Phenomena.S01E02.1080p.mkv'])).toBe('Archive X Unexplained Phenomena');
    expect(inferShowQuery(['C:\\TV\\Motto - 2x03 - Example.mp4'])).toBe('Motto');
    expect(inferShowQuery(['/media/Star Trek Voyager (1995) S01E01.mkv'])).toBe('Star Trek Voyager (1995)');
    expect(inferShowQuery(['/media/Sealab 2021 (2000) S01E01.mkv'])).toBe('Sealab 2021 (2000)');
  });

  it('uses the most common title across a mixed import', () => {
    expect(inferShowQuery([
      '/tv/Main.Show.S01E01.mkv',
      '/tv/Main.Show.S01E02.mkv',
      '/tv/Other.Show.S01E01.mkv',
    ])).toBe('Main Show');
  });

  it('does not guess when no episode marker is available', () => {
    expect(inferShowQuery(['/tv/random-video.mkv'])).toBeUndefined();
  });
});
