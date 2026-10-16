import { describe, expect, it } from 'vitest';
import { parseEpisodeCode, parseEpisodeCodes, parseStandaloneEpisode } from './episodeCode';

describe('episode code parser', () => {
  it.each([
    ['S03_03.mp4', 3, 3],
    ['S03-04.mkv', 3, 4],
    ['S03 05.avi', 3, 5],
  ])('recognises an S-prefixed season and separated episode: %s', (filename, season, episode) => {
    expect(parseEpisodeCode(filename)).toMatchObject({ season, episode });
  });

  it.each([
    'Report_2024_03.pdf',
    'Video_S03_1080p.mp4',
    'Archive_S03_2024.mkv',
  ])('does not treat unrelated separated numbers as an episode code: %s', (filename) => {
    expect(parseEpisodeCode(filename)).toBeUndefined();
  });

  it('recognises a dash-delimited standalone anime episode number', () => {
    expect(parseStandaloneEpisode("[Doomdos] - Marika's Love Meter Malfunction - 07 [Uncensored] [1080p].mkv"))
      .toMatchObject({ episode: 7 });
  });

  it.each(['Show 07.mkv', 'Show - 2026 [1080p].mkv', 'Show_07.mkv'])
    ('rejects an ambiguous bare number: %s', (filename) => {
      expect(parseStandaloneEpisode(filename)).toBeUndefined();
    });

  it.each([
    ['Show.S01E01E02.mkv', [1, 2]],
    ['Show.S01E01-E02.mkv', [1, 2]],
    ['Show.S01E01-03.mkv', [1, 2, 3]],
  ])('extracts multi-episode code %s', (filename, numbers) => {
    expect(parseEpisodeCodes(filename).map((item) => item.episode)).toEqual(numbers);
  });
});
