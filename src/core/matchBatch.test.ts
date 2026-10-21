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

  it('uses an embedded title as supporting episode evidence', () => {
    const [match] = matchFiles(['/media/Show.unknown.mkv'], [
      { id: '1', season: 1, number: 1, title: 'A Quiet Beginning' },
      { id: '2', season: 1, number: 2, title: 'The Storm Arrives' },
    ], true, () => undefined, .8, 'Show', {}, { '/media/Show.unknown.mkv': 'The Storm Arrives' });
    expect(match.match?.episode.id).toBe('2');
    expect(match.match?.reasons).toContain('embedded title 100%');
  });

  it('uses two adjacent numbered matches to suggest the episode between them', () => {
    const matches = matchFiles(['/media/Show.C.S01E03.mkv', '/media/Show.B.mkv', '/media/Show.A.S01E01.mkv'], [
      { id: '1', season: 1, number: 1, title: 'One' },
      { id: '2', season: 1, number: 2, title: 'Two' },
      { id: '3', season: 1, number: 3, title: 'Three' },
    ], false, () => undefined);
    expect(matches[1].match?.episode.id).toBe('2');
    expect(matches[1].match?.reasons).toContain('adjacent files bracket this episode');
    expect(matches[1].status).toBe('review');
  });
});
