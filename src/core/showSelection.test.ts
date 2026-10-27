import { describe, expect, it } from 'vitest';
import type { ShowDetails, ShowSearchResult } from './types';
import { automaticTvdbFallback, requestedEpisodeSeasons, seasonCompatibleShow } from './showSelection';

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

  it('silently accepts a sole TVDB fallback even when its translated alias differs', () => {
    const candidate = result('tvdb-1', 'Onaji Zemi no Someya-san ga Sexy Joyuu Datta Hanashi');
    expect(automaticTvdbFallback([candidate], "My Classmate's a Sexy Actress", 2026)).toBe(candidate);
  });

  it('silently accepts one exact translated match among additional results', () => {
    const exact = { ...result('tvdb-1', 'My Classmate’s a Sexy Actress'), year: 2026 };
    const other = { ...result('tvdb-2', 'Another Show'), year: 2026 };
    expect(automaticTvdbFallback([other, exact], "My Classmate's a Sexy Actress", 2026)).toBe(exact);
  });

  it('requires a choice only when multiple TVDB fallbacks remain uncertain', () => {
    const first = { ...result('tvdb-1', 'Romanized Alias'), year: 2026 };
    const second = { ...result('tvdb-2', 'Different Alias'), year: 2026 };
    expect(automaticTvdbFallback([first, second], 'English Translation', 2026)).toBeUndefined();
  });
});
