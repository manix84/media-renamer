import { describe, expect, it } from 'vitest';
import { inferShowQuery } from './showInference';

describe('show-name inference', () => {
  it('extracts a show title from common numbered episode names', () => {
    expect(inferShowQuery(['/media/Archive.X.Unexplained.Phenomena.S01E02.1080p.mkv'])).toBe('Archive X Unexplained Phenomena');
    expect(inferShowQuery(['C:\\TV\\Motto - 2x03 - Example.mp4'])).toBe('Motto');
    expect(inferShowQuery(['/media/Star Trek Voyager (1995) S01E01.mkv'])).toBe('Star Trek Voyager (1995)');
    expect(inferShowQuery(['/media/Sealab 2021 (2000) S01E01.mkv'])).toBe('Sealab 2021 (2000)');
  });

  it('accepts separated season and episode markers', () => {
    expect(inferShowQuery(['/media/Jackie Chan Adventures - S01 E01 - The Dark Hand.mp4'])).toBe('Jackie Chan Adventures');
    expect(inferShowQuery(['/media/Jackie Chan Adventures.S01-E02.The Power Within.mp4'])).toBe('Jackie Chan Adventures');
    expect(inferShowQuery(['/media/Jackie Chan Adventures_S01.E03_The Mask.mp4'])).toBe('Jackie Chan Adventures');
    expect(inferShowQuery(['/media/Jackie Chan Adventures - 1 x 25 - The New Atlantis.mp4'])).toBe('Jackie Chan Adventures');
  });

  it('extracts titles before standalone Ep and Episode numbers', () => {
    expect(inferShowQuery(['/media/MUMMIES ALIVE - Ep. 01 - Ra, Ra, Ra, Ra.mp4'])).toBe('MUMMIES ALIVE');
    expect(inferShowQuery(['/media/Mummies.Alive.Ep.02.Sleep.Walk.mkv'])).toBe('Mummies Alive');
    expect(inferShowQuery(['/media/Mummies Alive - Episode 03 - Pack to the Future.mp4'])).toBe('Mummies Alive');
  });

  it('extracts an anime title before a dash-delimited bare episode number', () => {
    expect(inferShowQuery(["/anime/[Doomdos] - Marika's Love Meter Malfunction - 07 [Uncensored] [Dub] [1080p OV WEB-DL].mkv"]))
      .toBe("Marika's Love Meter Malfunction");
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
    expect(inferShowQuery(['/tv/The Episode Guide.mkv'])).toBeUndefined();
  });
});
