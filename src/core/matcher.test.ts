import { describe, expect, it } from 'vitest';
import { matchFile, normalizeTitle } from './matcher';
import { parseReleaseTags } from './releaseTags';

const episodes = [
  { id: '1', season: 2, number: 7, title: 'The Security Guard' },
  { id: '2', season: 2, number: 8, title: 'The Merger' },
  { id: '3', season: 2, number: 9, title: 'The Off-Site Meeting' },
];

describe('release tag parser', () => {
  it('detects source, technical tags and flags', () => {
    expect(parseReleaseTags('Show.S02E08.1080p.WEB-DL.DDP5.1.x265.PROPER-GRP.mkv')).toMatchObject({
      source: 'WEB-DL', resolution: '1080p', videoCodec: 'x265', audioCodec: 'DDP', channels: '5.1', flags: ['PROPER'], group: 'GRP',
    });
  });
});

describe('episode matcher', () => {
  it('can prefer an episode title when numbering is wrong', () => {
    const result = matchFile('Dilbert.S02E07.The.Merger.DVDRip.x264.mkv', episodes, true);
    expect(result.match?.episode.title).toBe('The Merger');
    expect(result.status).toBe('review');
  });

  it('normalizes punctuation and noise', () => {
    expect(normalizeTitle("The.Off-Site.Meeting.720p.WEBRip")).toEqual(['off', 'site', 'meeting']);
  });

  it('matches files from different seasons in a combined episode catalogue', () => {
    const combined = [
      { id: 's1', season: 1, number: 2, title: 'An Early Episode' },
      { id: 's4', season: 4, number: 2, title: 'A Later Episode' },
    ];
    expect(matchFile('Show.S01E02.mkv', combined).match?.episode.id).toBe('s1');
    expect(matchFile('Show.S04E02.mkv', combined).match?.episode.id).toBe('s4');
  });
});
