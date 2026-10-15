import { describe, expect, it, vi } from 'vitest';
import { matchFiles } from './matchBatch';

describe('file matching batch', () => {
  it('reports the completed and remaining file count throughout a batch', () => {
    const progress = vi.fn();
    const matches = matchFiles(
      ['Show.S01E01.mkv', 'Show.S01E02.mkv', 'Show.S01E03.mkv'],
      [
        { id: '1', season: 1, number: 1, title: 'One' },
        { id: '2', season: 1, number: 2, title: 'Two' },
        { id: '3', season: 1, number: 3, title: 'Three' },
      ],
      true,
      progress,
    );
    expect(matches).toHaveLength(3);
    expect(progress.mock.calls).toEqual([[1, 3], [2, 3], [3, 3]]);
  });

  it('passes probed file durations into episode matching', () => {
    const [match] = matchFiles(
      ['/media/Show.Pilot.mkv'],
      [
        { id: 'short', season: 1, number: 1, title: 'Pilot Part One', runtimeMinutes: 22 },
        { id: 'long', season: 1, number: 2, title: 'Pilot Part Two', runtimeMinutes: 44 },
      ],
      true,
      () => undefined,
      .8,
      'Show',
      { '/media/Show.Pilot.mkv': 44 * 60 },
    );
    expect(match.match?.episode.id).toBe('long');
  });
});
