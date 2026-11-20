import { describe, expect, it } from 'vitest';
import { displayEpisodeTitle, episodesForFilename, searchEpisodeReviewCandidates, sharedSplitEpisodeTitle, splitEpisodeReviewCandidates, updateEpisodeReviewSelection } from './splitEpisodes';

const pair = [
  { id: 'e21', season: 2, number: 21, title: 'Mouth of the Snake (1)' },
  { id: 'e22', season: 2, number: 22, title: 'Mouth of the Snake (2)' },
];

describe('split episode titles', () => {
  it('keeps an episode-code search as one manually selected episode', () => {
    const episodes = Array.from({ length: 20 }, (_, index) => ({
      id: `e${index + 1}`,
      season: 4,
      number: index + 1,
      title: index === 0 ? '20 Hours in America (1)' : `Episode ${index + 1}`,
    }));

    expect(searchEpisodeReviewCandidates(episodes, 'S04E01')).toEqual([{
      episode: episodes[0],
      score: 1,
      reasons: ['manually selected'],
    }]);
  });

  it('recognises adjacent episodes with matching titles and distinct trailing part markers', () => {
    expect(sharedSplitEpisodeTitle(pair)).toBe('Mouth of the Snake');
    expect(sharedSplitEpisodeTitle([{ ...pair[0], title: 'One' }, { ...pair[1], title: 'Two' }])).toBeUndefined();
  });

  it('keeps the full episode range while consolidating matching part titles', () => {
    expect(episodesForFilename(pair)).toEqual([{ ...pair[0], title: 'Mouth of the Snake' }, { ...pair[1], title: '' }]);
  });

  it('keeps the part marker for a file containing only one episode', () => {
    expect(episodesForFilename([pair[1]])).toEqual([pair[1]]);
  });

  it('removes part markers from distinct titles without consolidating them', () => {
    const distinct = [{ ...pair[0], title: 'Episode Name (1)' }, { ...pair[1], title: 'My Show (2)' }];
    expect(episodesForFilename(distinct)).toEqual([{ ...distinct[0], title: 'Episode Name' }, { ...distinct[1], title: 'My Show' }]);
  });

  it('consolidates identical titles even when they have no part marker', () => {
    const identical = pair.map((episode) => ({ ...episode, title: 'Episode Name' }));
    expect(episodesForFilename(identical)).toEqual([{ ...identical[0], title: 'Episode Name' }, { ...identical[1], title: '' }]);
  });

  it('recognises common best-effort part marker variants', () => {
    for (const titles of [
      ['Story Part #1', 'Story Part #2'],
      ['Story Pt. I', 'Story Pt. II'],
      ['Story (Part 1)', 'Story (Part 2)'],
      ['Story [1]', 'Story [2]'],
      ['Story (1 of 2)', 'Story (2 of 2)'],
      ['Story #1', 'Story #2'],
    ]) {
      expect(episodesForFilename(pair.map((episode, index) => ({ ...episode, title: titles[index] })))).toEqual([
        { ...pair[0], title: 'Story' }, { ...pair[1], title: '' },
      ]);
    }
  });

  it('leaves raw provider titles untouched when compaction is disabled', () => {
    expect(episodesForFilename(pair, false)).toEqual(pair);
  });

  it('offers grouped matches only as individual episode rows', () => {
    const candidate = { episode: pair[0], episodes: pair, score: .95, reasons: ['2 episode numbers'] };
    const choices = splitEpisodeReviewCandidates(candidate);
    expect(choices.map((choice) => [choice.episode.id])).toEqual([['e21'], ['e22']]);
    expect(choices.map(displayEpisodeTitle)).toEqual(['Mouth of the Snake (1)', 'Mouth of the Snake (2)']);
  });

  it('supports toggle and range selection across individual episode rows', () => {
    const visible = [1, 2, 3, 4].map((number) => ({ episode: { id: `e${number}`, season: 4, number, title: `Episode ${number}` }, score: 1, reasons: [] }));
    const first = updateEpisodeReviewSelection(undefined, visible, 'e1', { toggle: false, range: false });
    const toggled = updateEpisodeReviewSelection(first.candidate, visible, 'e3', { toggle: true, range: false, anchorId: first.anchorId });
    const ranged = updateEpisodeReviewSelection(undefined, visible, 'e3', { toggle: false, range: true, anchorId: 'e1' });

    expect(toggled.candidate?.episodes?.map(({ id }) => id)).toEqual(['e1', 'e3']);
    expect(ranged.candidate?.episodes?.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3']);
  });
});
