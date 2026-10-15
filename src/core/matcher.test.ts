import { describe, expect, it } from 'vitest';
import { matchFile, normalizeTitle } from './matcher';
import { applyReleaseOverrides, parseReleaseTags } from './releaseTags';

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

  it('detects AI upscaling and release details from ancestor folders', () => {
    expect(parseReleaseTags('/TV/Star Trek Voyager S03 AI Upscale 720p x265/Star Trek - S03E01 - Basics.mkv')).toMatchObject({
      resolution: '720p', videoCodec: 'x265', flags: ['AI Upscale'], group: undefined,
    });
  });

  it('treats a standalone BD token in an ancestor folder as BluRay source evidence', () => {
    expect(parseReleaseTags('/TV/Dagashi Kashi S02 1080p BD/[Group] Dagashi Kashi - S02E01.mkv').source).toBe('BluRay');
    expect(parseReleaseTags('/TV/BDArchives/Show.S01E01.mkv').source).toBe('Unknown');
  });

  it('can override uncertain source and AI-upscale metadata across a batch', () => {
    const detected = parseReleaseTags('/TV/Show AI Upscaled/Show.S01E01.mkv');
    expect(applyReleaseOverrides(detected, { source: 'DVD', aiUpscale: false })).toMatchObject({ source: 'DVD', flags: [] });
    expect(applyReleaseOverrides(detected, { source: 'DVD', aiUpscale: true })).toMatchObject({ source: 'DVD', flags: ['AI Upscale'] });
  });

  it.each([
    ['Anime.S01E01v2.1080p.mkv', 'REPACK'],
    ['Anime.S05E10v3.1080p.mkv', 'REPACK'],
    ['Anime.01x02v4.1080p.mkv', 'REPACK'],
  ])('treats an attached anime version as a repack: %s', (filename, flag) => {
    expect(parseReleaseTags(filename).flags).toContain(flag);
  });

  it('does not treat a first-version episode as a repack', () => {
    expect(parseReleaseTags('Anime.S01E01v1.1080p.mkv').flags).not.toContain('REPACK');
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

  it('uses the configured confidence threshold for automatic acceptance', () => {
    const titleOnly = 'Dilbert.The.Merger.DVDRip.x264.mkv';
    expect(matchFile(titleOnly, episodes, true, 0.5).status).toBe('confident');
    expect(matchFile(titleOnly, episodes, true, 0.8).status).toBe('review');
  });
});
