import { describe, expect, it } from 'vitest';
import { DEFAULT_EPISODE_TEMPLATE, formatEpisode, templateError } from './formatter';
import type { Episode, ReleaseTags } from './types';

const tags: ReleaseTags = { source: 'WEB-DL', resolution: '1080p', videoCodec: 'H.264', flags: [], audioCodec: 'AAC', channels: '2.0' };
const episodes: Episode[] = [
  { id: '1', season: 1, number: 1, title: 'Episode 1' },
  { id: '2', season: 1, number: 2, title: 'Episode 2' },
];

describe('episode filename templates', () => {
  it('formats the default single-episode name with literal square brackets', () => {
    expect(formatEpisode(DEFAULT_EPISODE_TEMPLATE, 'Show Name', 2026, episodes[0], tags, '74550'))
      .toBe('Show Name (2026) - S01E01 - Episode 1 [1080p WEB-DL H.264 AAC 2.0] {tvdb-74550}');
  });

  it('repeats an episode section for merged episodes', () => {
    expect(formatEpisode(DEFAULT_EPISODE_TEMPLATE, 'Show Name', undefined, episodes, tags))
      .toBe('Show Name - S01E01-E02 - Episode 1, Episode 2 [1080p WEB-DL H.264 AAC 2.0]');
  });

  it('omits the TVDB block when the show has no TVDB cross-reference', () => {
    expect(formatEpisode(DEFAULT_EPISODE_TEMPLATE, 'Show Name', 2026, episodes[0], tags))
      .toBe('Show Name (2026) - S01E01 - Episode 1 [1080p WEB-DL H.264 AAC 2.0]');
  });

  it('supports optional sections and individual release fields', () => {
    const template = '{{show.name}}{{#show.year}} ({{show.year}}){{/show.year}} {{#release.audioCodec}}[{{release.audioCodec}} {{release.channels}}]{{/release.audioCodec}}';
    expect(formatEpisode(template, 'Show', undefined, episodes[0], tags)).toBe('Show [AAC 2.0]');
  });

  it('collapses script layout and nested indentation without adding filename spaces', () => {
    const template = [
      '{{show.name}}',
      '{{#show.year}} ({{show.year}}){{/show.year}}',
      '- ',
      '{{episode.range}} - ',
      '{{#episodes}}',
      '  {{^first}}, {{/first}}',
      '  {{title}}',
      '{{/episodes}}',
      '{{#technical}} [{{technical}}]{{/technical}}',
      '{{#show.tvdbId}} {tvdb-{{show.tvdbId}}}{{/show.tvdbId}}',
    ].join('\n');
    expect(formatEpisode(template, 'Show Name', 2026, episodes, tags, '74550'))
      .toBe('Show Name (2026) - S01E01-E02 - Episode 1, Episode 2 [1080p WEB-DL H.264 AAC 2.0] {tvdb-74550}');
  });

  it('reports mismatched sections', () => {
    expect(templateError('{{#episodes}}{{title}}{{/show.year}}')).toBe('Unexpected closing section “show.year”');
  });

  it('reports incomplete tags and unknown fields', () => {
    expect(templateError('{{show.name')).toBe('A template tag is not complete');
    expect(templateError('{{show.title}}')).toBe('Unknown field “show.title”');
  });
});
