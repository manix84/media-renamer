import { describe, expect, it } from 'vitest';
import { parseDebugDemo } from './debugDemo';

describe('debug demo scenarios', () => {
  it('parses TV rows and simulation flags', () => {
    const result = parseDebugDemo('# comment\nSeverance.S02E03.mkv | fail=publishing copy sidecars=2', 'shows');
    expect(result.errors).toEqual([]);
    expect(result.items[0]).toMatchObject({ season: 2, episode: 3, moveMethod: 'copy', sidecars: 2, failurePhase: 'publishing' });
  });

  it('parses movie years and atomic rename simulations', () => {
    const result = parseDebugDemo('Movie.Name.2024.mkv | success rename', 'movies');
    expect(result.errors).toEqual([]);
    expect(result.items[0]).toMatchObject({ moveMethod: 'rename' });
  });

  it('reports invalid rows and flags with line numbers', () => {
    const result = parseDebugDemo('| success\nShow.S01E01.mkv | sidecars=99 mystery', 'shows');
    expect(result.errors).toEqual([
      'Line 1: expected fake filename | simulation flags',
      'Line 2: sidecars must be between 0 and 20',
      'Line 2: unknown flag “mystery”',
    ]);
  });
});
