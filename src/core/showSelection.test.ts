import { describe, expect, it } from 'vitest';
import type { ShowDetails, ShowSearchResult } from './types';
import { requestedEpisodeSeasons, seasonCompatibleShow } from './showSelection';

const result = (id: string, name: string): ShowSearchResult => ({ id, name, overview: '' });
const details = (id: string, name: string, seasons: number[]): ShowDetails => ({
  ...result(id, name),
  seasons: seasons.map((number) => ({ number, name: `Season ${number}`, episodeCount: 12 })),
});

describe('automatic show selection', () => {
  it('extracts explicit requested seasons from anime revision filenames', () => {
    expect(requestedEpisodeSeasons([
      '[Judas] Tensei Shitara Slime Datta Ken - S04E01v2.mkv',
      '[Judas] Tensei Shitara Slime Datta Ken - S04E02v2.mkv',
    ])).toEqual([4]);
  });

  it('prefers a candidate that contains the imported seasons', () => {
    const diaries = result('diaries', 'The Slime Diaries');
    const main = result('main', 'That Time I Got Reincarnated as a Slime');
    expect(seasonCompatibleShow(
      [diaries, main],
      [details('diaries', diaries.name, [1]), details('main', main.name, [0, 1, 2, 3, 4])],
      [4],
    )).toBe(main);
  });

  it('preserves provider order when no candidate satisfies the season evidence', () => {
    const first = result('first', 'First');
    expect(seasonCompatibleShow([first], [details('first', first.name, [1])], [4])).toBe(first);
  });
});
