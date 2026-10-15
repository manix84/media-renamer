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

  it.each([
    'Show.S01E02.mkv',
    'Show - S01 E02 - An Early Episode.mkv',
    'Show.S01-E02.An Early Episode.mkv',
    'Show_S01.E02_An Early Episode.mkv',
    'Show - 1x02 - An Early Episode.mkv',
    'Show - 1 x 2 - An Early Episode.mkv',
  ])('matches separated episode code format %s', (filename) => {
    const result = matchFile(filename, [{ id: 's1e2', season: 1, number: 2, title: 'An Early Episode' }]);
    expect(result.match?.episode.id).toBe('s1e2');
    expect(result.match?.reasons).toContain('season and episode number');
  });

  it('uses the configured confidence threshold for automatic acceptance', () => {
    const titleOnly = 'Dilbert.The.Merger.DVDRip.x264.mkv';
    expect(matchFile(titleOnly, episodes, true, 0.5).status).toBe('confident');
    expect(matchFile(titleOnly, episodes, true, 0.8).status).toBe('review');
  });

  it('does not use the show title as episode-title evidence', () => {
    const result = matchFile('His.Dark.Materials.S01E04.1080p.BluRay.x265-RARBG.mp4', [
      { id: 'special', season: 0, number: 1, title: 'Making His Dark Materials' },
      { id: 'episode', season: 1, number: 4, title: 'Armour' },
    ], true, 0.8, 'His Dark Materials');

    expect(result.match?.episode.id).toBe('episode');
    expect(result.match?.score).toBe(0.45);
    expect(result.match?.reasons).toEqual(['season and episode number']);
  });

  it('still matches the unique part of an episode title that repeats the show name', () => {
    const result = matchFile('The.Office.S02E03.Office.Olympics.mkv', [
      { id: 'episode', season: 2, number: 3, title: 'Office Olympics' },
    ], true, 0.8, 'The Office');

    expect(result.match?.episode.id).toBe('episode');
    expect(result.match?.reasons.some((reason) => reason.startsWith('title '))).toBe(true);
  });

  it('uses duration as supporting evidence when episode runtimes differ', () => {
    const result = matchFile('Show.Pilot.mkv', [
      { id: 'short', season: 1, number: 1, title: 'Pilot Part One', runtimeMinutes: 22 },
      { id: 'long', season: 1, number: 2, title: 'Pilot Part Two', runtimeMinutes: 44 },
    ], true, .8, 'Show', 43.5 * 60);

    expect(result.match?.episode.id).toBe('long');
    expect(result.match?.reasons).toContain('duration matches 44m runtime');
  });

  it('does not penalize a duration mismatch or match from duration alone', () => {
    const numbered = matchFile('Show.S01E01.mkv', [{ id: 'episode', season: 1, number: 1, title: 'Pilot', runtimeMinutes: 22 }], false, .8, 'Show', 44 * 60);
    const durationOnly = matchFile('Unrelated.mkv', [{ id: 'episode', season: 1, number: 1, title: 'Pilot', runtimeMinutes: 44 }], false, .8, 'Show', 44 * 60);

    expect(numbered.match?.score).toBe(.45);
    expect(durationOnly.match).toBeUndefined();
  });
});
