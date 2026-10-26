import { describe, expect, it } from 'vitest';
import { displayEpisodeTitle, episodesForFilename, sharedSplitEpisodeTitle, splitEpisodeReviewCandidates } from './splitEpisodes';

const pair = [
  { id: 'e21', season: 2, number: 21, title: 'Mouth of the Snake (1)' },
  { id: 'e22', season: 2, number: 22, title: 'Mouth of the Snake (2)' },
];

describe('split episode titles', () => {
  it('recognises adjacent episodes with matching titles and distinct trailing part markers', () => {
    expect(sharedSplitEpisodeTitle(pair)).toBe('Mouth of the Snake');
    expect(sharedSplitEpisodeTitle([{ ...pair[0], title: 'One' }, { ...pair[1], title: 'Two' }])).toBeUndefined();
  });

  it('formats a combined selection with only its first episode and the shared title', () => {
    expect(episodesForFilename(pair, pair)).toEqual([{ ...pair[0], title: 'Mouth of the Snake' }]);
  });

  it('cleans either single selection when its split sibling exists', () => {
    expect(episodesForFilename([pair[1]], pair)).toEqual([{ ...pair[1], title: 'Mouth of the Snake' }]);
  });

  it('offers each episode separately before the combined selection', () => {
    const candidate = { episode: pair[0], episodes: pair, score: .95, reasons: ['2 episode numbers'] };
    const choices = splitEpisodeReviewCandidates(candidate);
    expect(choices.map((choice) => choice.episodes?.map((episode) => episode.id) ?? [choice.episode.id])).toEqual([['e21'], ['e22'], ['e21', 'e22']]);
    expect(choices.slice(0, 2).map(displayEpisodeTitle)).toEqual(['Mouth of the Snake', 'Mouth of the Snake']);
    expect(displayEpisodeTitle(choices[2])).toBe('Mouth of the Snake');
  });
});
