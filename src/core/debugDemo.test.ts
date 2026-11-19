import { describe, expect, it } from 'vitest';
import { parseDebugDemo } from './debugDemo';

describe('debug demo scenarios', () => {
  it('parses TV rows and simulation flags', () => {
    const result = parseDebugDemo('# comment\nShow.S02E03.mkv | The Episode | fail=publishing copy sidecars=2', 'shows');
    expect(result.errors).toEqual([]);
    expect(result.items[0]).toMatchObject({ season: 2, episode: 3, title: 'The Episode', moveMethod: 'copy', sidecars: 2, failurePhase: 'publishing' });
  });

  it('parses movie years and atomic rename simulations', () => {
    const result = parseDebugDemo('Movie.mkv | Movie Name | success rename year=2024', 'movies');
    expect(result.errors).toEqual([]);
    expect(result.items[0]).toMatchObject({ title: 'Movie Name', year: 2024, moveMethod: 'rename' });
  });

  it('reports invalid rows and flags with line numbers', () => {
    const result = parseDebugDemo('missing fields\nShow.S01E01.mkv | Pilot | sidecars=99 mystery', 'shows');
    expect(result.errors).toEqual([
      'Line 1: expected source filename | title | flags',
      'Line 2: sidecars must be between 0 and 20',
      'Line 2: unknown flag “mystery”',
    ]);
  });
});
