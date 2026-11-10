import { describe, expect, it } from 'vitest';
import { matchFile, normalizeTitle } from './matcher';
import { applyReleaseOverrides, formatEditionNames, normalizeMovieEditionName, parseExplicitEdition, parseMovieEdition, parseReleaseTags } from './releaseTags';
import { parseReleaseAliasText } from './releaseAliases';

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

  it.each([
    ['Show.PDTV.mkv', 'PDTV'], ['Show.Pure.Digital.Television.mkv', 'PDTV'],
    ['Show.High.Definition.TV.mkv', 'HDTV'], ['Show.web-download.mkv', 'WEB-DL'],
    ['Show.BD-Rip.mkv', 'BDRip'], ['Show.Blu-ray.Disc.Rip.mkv', 'BDRip'],
    ['Show.BR-Rip.mkv', 'BRRip'], ['Show.BluRay.Rip.mkv', 'BRRip'],
    ['Show.Digital.Versatile.Disc.Rip.mkv', 'DVDRip'], ['Show.DS-Rip.mkv', 'DSRip'],
    ['Show.Digital.Satellite.Rip.mkv', 'DSRip'], ['Show.Television.Rip.mkv', 'TVRip'],
    ['Show.Camera.Rip.mkv', 'CAMRip'], ['Show.Telesync.mkv', 'TS'],
    ['Show.Workprint.mkv', 'WP'], ['Show.Pay.Per.View.Rip.mkv', 'PPVRip'],
    ['Show.Video.On.Demand.Rip.mkv', 'VODRip'], ['Show.HDDVD.mkv', 'HD-DVD'],
    ['Show.LD-Rip.mkv', 'LaserDisc'], ['Show.Video.Home.System.Rip.mkv', 'VHS'],
  ])('normalises source aliases: %s → %s', (filename, source) => {
    expect(parseReleaseTags(filename).source).toBe(source);
  });

  it.each([
    ['Show.S01E01.1080p.NF.WEB-DL.x265-QxR.mkv', 'Netflix', 'NF', 'QxR'],
    ['Show.S01E01.1080p.Netflix.WEB-DL.x265-VARYG.mkv', 'Netflix', 'NF', 'VARYG'],
    ['[VARYG] Show - 01 [1080p CR WEB-DL].mkv', 'Crunchyroll', 'CR', 'VARYG'],
    ['[QxR] Show - 01 [1080p CrunchyRoll WEBRip].mkv', 'Crunchyroll', 'CR', 'QxR'],
  ])('normalises web origin and detects release group: %s', (filename, webOrigin, webOriginShort, group) => {
    expect(parseReleaseTags(filename)).toMatchObject({ webOrigin, webOriginShort, group });
  });

  it('does not infer a short web origin outside a web release', () => {
    const tags = parseReleaseTags('CR.Documentary.2026.1080p.BluRay-QxR.mkv');
    expect(tags.group).toBe('QxR');
    expect(tags.webOrigin).toBeUndefined();
    expect(tags.webOriginShort).toBeUndefined();
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
    ["Blade.Runner.1982.Directors.Cut.1080p.BluRay.mkv", 'Blade Runner', 1982, "Director's Cut"],
    ['Movie.2020.Extended.Edition.1080p.mkv', 'Movie', 2020, 'Extended'],
    ['Movie.2020.25th.Anniversary.Edition.1080p.mkv', 'Movie', 2020, 'Anniversary Edition'],
    ['Movie.2020.4K.Remaster.1080p.mkv', 'Movie', 2020, 'Remastered'],
    ['Movie.2020.HDCAMRip.mkv', 'Movie', 2020, 'HD CAM'],
    ['Movie.2020.HD-TS.DTS.mkv', 'Movie', 2020, 'HD Telesync'],
    ['Total.Recall.Mind.Bending.Edition.1990.1080p.BluRay.mkv', 'Total Recall', 1990, 'Mind Bending'],
  ])('normalises a movie edition after the matched title: %s', (filename, title, year, edition) => {
    expect(parseMovieEdition(filename, title, year).edition).toBe(edition);
  });

  it('maps saved custom spellings onto movie editions', () => {
    const aliases = parseReleaseAliasText("edition = directors version => Director's Cut").aliases;
    expect(parseMovieEdition('Movie.2020.Directors.Version.1080p.mkv', 'Movie', 2020, aliases).edition).toBe("Director's Cut");
  });

  it.each([
    '3D', 'Anniversary Edition', 'Assembly Cut', 'Black and White', 'CAM', "Collector's Edition",
    'Criterion Collection', 'Deluxe Edition', "Director's Cut", "Director's Edition", 'Extended',
    'Fan Edit', 'Final Cut', 'HD CAM', 'HD Telecine', 'HD Telesync', 'IMAX', 'IMAX Enhanced',
    'International Cut', 'Limited Edition', 'Mind Bending', 'Open Matte', 'Remastered', 'Restored', 'Redux',
    'Roadshow Version', 'SBS', 'Special Edition', 'Telecine', 'Telesync', 'Theatrical Cut',
    'Ultimate Edition', 'Uncut', 'Unrated', 'Workprint',
  ])('supports the canonical FlexGet movie edition %s', (edition) => {
    const source = edition.replace(/ /g, '.');
    expect(parseMovieEdition(`Movie.2020.${source}.1080p.mkv`, 'Movie', 2020).edition).toBe(edition);
  });

  it.each([
    ['Movie.2020.HDTS.mkv', 'HD Telesync'],
    ['Movie.2020.HD-TC.mkv', 'HD Telecine'],
    ['Movie.2020.HQCAM.mkv', 'HD CAM'],
    ['Movie.2020.CAMRip.mkv', 'CAM'],
    ['Movie.2020.Restoration.mkv', 'Restored'],
  ])('normalises compact edition alias %s', (filename, edition) => {
    expect(parseMovieEdition(filename, 'Movie', 2020).edition).toBe(edition);
  });

  it('preserves source order, removes duplicates, and prefers overlapping specific names', () => {
    expect(parseMovieEdition('Movie.2020.IMAX.Enhanced.Directors.Cut.Extended.IMAX.1080p.mkv', 'Movie', 2020).edition)
      .toBe("IMAX Enhanced, Director's Cut, Extended, and IMAX");
    expect(formatEditionNames(['Unrated', 'Uncut'])).toBe('Unrated and Uncut');
  });

  it('canonicalizes and deduplicates alternate movie-edition spellings', () => {
    expect(normalizeMovieEditionName("Directors Cut and Director's Cut")).toBe("Director's Cut");
    expect(normalizeMovieEditionName('Collectors Edition, Extended Edition, and 25th Anniversary Edition'))
      .toBe("Collector's Edition, Extended, and Anniversary Edition");
  });

  it('normalises multiple names inside one explicit movie edition marker', () => {
    expect(parseMovieEdition("Movie (2020) {edition-Unrated and Uncut} [1080P].mkv", 'Movie', 2020).edition).toBe('Unrated and Uncut');
    expect(parseMovieEdition("Movie (2020) {edition-Director's Cut, Extended, and IMAX} [1080P].mkv", 'Movie', 2020).edition)
      .toBe("Director's Cut, Extended, and IMAX");
    expect(parseMovieEdition('Movie (2020) {edition-Unknown Cut}.mkv', 'Movie', 2020).error).toMatch(/Unsupported/);
  });

  it('does not infer edition words from the matched movie title or partial technical tokens', () => {
    expect(parseMovieEdition('Uncut.Gems.2019.1080p.DTS.mkv', 'Uncut Gems', 2019).edition).toBeUndefined();
    expect(parseMovieEdition('Piranha.3D.2010.1080p.mkv', 'Piranha 3D', 2010).edition).toBeUndefined();
  });

  it('falls back to the matched year but does not infer without title or year evidence', () => {
    expect(parseMovieEdition('Unknown.Movie.2020.Final.Cut.mkv', 'Different Title', 2020).edition).toBe('Final Cut');
    expect(parseMovieEdition('Unknown.Movie.Final.Cut.mkv', 'Different Title', undefined).edition).toBeUndefined();
  });

  it('preserves explicit TV editions and rejects malformed or conflicting markers', () => {
    expect(parseReleaseTags('/TV/Show {edition-Color}/Show.S01E01.{edition-Color}.mkv').edition).toBe('Color');
    expect(parseExplicitEdition('/TV/Show {edition-Color}/Show.S01E01.{edition-Black & White}.mkv').error).toMatch(/Conflicting/);
    expect(parseReleaseTags('/TV/Show {edition-Color}/Show.S01E01.{edition-Black & White}.mkv').editionError).toMatch(/Conflicting/);
    expect(parseExplicitEdition('Show.S01E01.{edition- }.mkv').error).toMatch(/malformed/);
    expect(parseExplicitEdition('Show.S01E01.{edition-Color.mkv').error).toMatch(/malformed/);
  });

  it.each([
    ['Anime.S01E01v2.1080p.mkv', 'REPACK'],
    ['Anime.S05E10v3.1080p.mkv', 'REPACK'],
    ['Anime.01x02v4.1080p.mkv', 'REPACK'],
    ['[sam] The Ghost in the Shell (2026) - 01v2 [WEB 1080p EAC-3].mkv', 'REPACK'],
  ])('treats an attached anime version as a repack: %s', (filename, flag) => {
    expect(parseReleaseTags(filename).flags).toContain(flag);
  });

  it('does not treat a first-version episode as a repack', () => {
    expect(parseReleaseTags('Anime.S01E01v1.1080p.mkv').flags).not.toContain('REPACK');
    expect(parseReleaseTags('Anime - 01v1 [1080p].mkv').flags).not.toContain('REPACK');
  });
});

describe('episode matcher', () => {
  it('confidently matches a compact season and episode code corroborated by its title', () => {
    const result = matchFile("The Starlost 114 - Farthing's Comet.m4v", [
      { id: 's1e14', season: 1, number: 14, title: "Farthing's Comet" },
      { id: 's1e15', season: 1, number: 15, title: 'The Beehive' },
    ], true, .8, 'The Starlost');

    expect(result.match?.episode.id).toBe('s1e14');
    expect(result.match?.reasons).toContain('season and episode number');
    expect(result.status).toBe('confident');
  });

  it('uses a season folder with a filename episode number', () => {
    const result = matchFile('/tv/Fringe/Season 3/04 - Electric Sheep.mkv', [
      { id: 's1e4', season: 1, number: 4, title: 'Arrival' },
      { id: 's3e4', season: 3, number: 4, title: 'Do Shapeshifters Dream of Electric Sheep?' },
    ], false);
    expect(result.match?.episode.id).toBe('s3e4');
    expect(result.match?.reasons).toContain('season folder and episode number');
  });

  it('keeps an explicit filename season authoritative over its folder', () => {
    const result = matchFile('/tv/Fringe/Season 2/Fringe.S03E04.mkv', [
      { id: 's2e4', season: 2, number: 4, title: 'Momentum Deferred' },
      { id: 's3e4', season: 3, number: 4, title: 'Do Shapeshifters Dream of Electric Sheep?' },
    ], false);
    expect(result.match?.episode.id).toBe('s3e4');
    expect(result.match?.reasons).toContain('season and episode number');
  });

  it('does not infer an episode from a non-episode filename in a season folder', () => {
    expect(matchFile('/tv/Fringe/Season 3/featurette.mkv', [
      { id: 's3e1', season: 3, number: 1, title: 'Olivia' },
    ], false).status).toBe('unmatched');
  });

  it('can prefer an episode title when numbering is wrong', () => {
    const result = matchFile('Dilbert.S02E07.The.Merger.DVDRip.x264.mkv', episodes, true);
    expect(result.match?.episode.title).toBe('The Merger');
    expect(result.status).toBe('review');
  });

  it('accepts a numbered episode when an alternate provider title matches the filename', () => {
    const result = matchFile('Sonic X - S01 E01 - Enter the Supersonic Hero (480p DVDRip).mp4', [{
      id: 'sonic-x-s01e01', season: 1, number: 1, title: 'Chaos Control Freaks', alternateTitles: ['Enter the Supersonic Hero'],
    }], true, .8, 'Sonic X');

    expect(result.match?.episode.title).toBe('Chaos Control Freaks');
    expect(result.match?.reasons.some((reason) => reason.startsWith('alternate title '))).toBe(true);
    expect(result.status).toBe('confident');
  });

  it('normalizes punctuation and noise', () => {
    expect(normalizeTitle("The.Off-Site.Meeting.720p.WEBRip")).toEqual(['off', 'site', 'meeting']);
    expect(normalizeTitle('Anime.S04E02v2.Episode.Two.1080p')).toEqual(['anime', 'two']);
  });

  it('matches files from different seasons in a combined episode catalogue', () => {
    const combined = [
      { id: 's1', season: 1, number: 2, title: 'An Early Episode' },
      { id: 's4', season: 4, number: 2, title: 'A Later Episode' },
    ];
    expect(matchFile('Show.S01E02.mkv', combined).match?.episode.id).toBe('s1');
    expect(matchFile('Show.S04E02.mkv', combined).match?.episode.id).toBe('s4');
  });

  it('confidently accepts an exact season and episode code when no episode title is present', () => {
    const result = matchFile('[Group] Show.Name.S03E07.1080p.WEB-DL.x265.mkv', [
      { id: 's3e7', season: 3, number: 7, title: 'A Title the File Does Not Contain' },
      { id: 's3e8', season: 3, number: 8, title: 'The Next Episode' },
    ], true, .8, 'Show Name');
    expect(result.match?.episode.id).toBe('s3e7');
    expect(result.match?.score).toBeCloseTo(.85);
    expect(result.match?.reasons).toContain('exact numbering with no conflicting episode title');
    expect(result.status).toBe('confident');
  });

  it('maps an impossible season episode number as a cumulative episode number', () => {
    const catalogue = [
      ...Array.from({ length: 26 }, (_, index) => ({ id: `s1e${index + 1}`, season: 1, number: index + 1, absoluteNumber: index + 1, title: `Season one ${index + 1}` })),
      ...Array.from({ length: 26 }, (_, index) => ({ id: `s2e${index + 1}`, season: 2, number: index + 1, absoluteNumber: index + 27, title: `Season two ${index + 1}` })),
    ];
    const result = matchFile('Sonic X - S02E27 - unknown [480P DVDRIP H264 AC3].mp4', catalogue, true, .8, 'Sonic X');

    expect(result.match?.episode.id).toBe('s2e1');
    expect(result.match?.reasons).toContain('cumulative episode number mapped into stated season');
    expect(result.status).toBe('confident');
  });

  it('does not reinterpret an invalid episode number when its cumulative position belongs to another season', () => {
    const catalogue = [
      ...Array.from({ length: 10 }, (_, index) => ({ id: `s1e${index + 1}`, season: 1, number: index + 1, title: `Season one ${index + 1}` })),
      ...Array.from({ length: 10 }, (_, index) => ({ id: `s2e${index + 1}`, season: 2, number: index + 1, title: `Season two ${index + 1}` })),
    ];
    const result = matchFile('Show.S02E25.mkv', catalogue, false, .8, 'Show');

    expect(result.match).toBeUndefined();
  });

  it('does not apply number-only confidence when unmatched title text is present', () => {
    const result = matchFile('Show.Name.S03E07.Completely.Different.Words.mkv', [
      { id: 's3e7', season: 3, number: 7, title: 'Expected Title' },
    ], true, .8, 'Show Name');
    expect(result.match?.score).toBe(.45);
    expect(result.status).toBe('review');
  });

  it('matches an anime episode with an attached release revision', () => {
    const result = matchFile('[Judas] Tensei Shitara Slime Datta Ken - S04E02v2.mkv', [
      { id: 's4e2', season: 4, number: 2, title: 'Episode Two' },
    ], false);
    expect(result.match?.episode.id).toBe('s4e2');
    expect(result.tags.flags).toContain('REPACK');
    expect(result.status).toBe('review');
  });

  it.each([
    'Show.S01E02.mkv',
    'Show - S01 E02 - An Early Episode.mkv',
    'Show.S01-E02.An Early Episode.mkv',
    'Show_S01.E02_An Early Episode.mkv',
    'Show - 1x02 - An Early Episode.mkv',
    'Show - 1 x 2 - An Early Episode.mkv',
    'Show_S01_02_An Early Episode.mkv',
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

  it('matches a dash-delimited bare episode number when it identifies one season', () => {
    const result = matchFile("[Doomdos] - Marika's Love Meter Malfunction - 07 [Uncensored] [Dub] [1080p OV WEB-DL].mkv", [
      { id: 'episode-7', season: 1, number: 7, title: 'The Original-Exceeding Lovemeter' },
      { id: 'episode-8', season: 1, number: 8, title: 'The Completely Kaput Lovemeter' },
    ], true, .8, "Marika's Love Meter Malfunction");

    expect(result.match?.episode.id).toBe('episode-7');
    expect(result.match?.reasons).toContain('episode number in the only matching season');
  });

  it('matches a versioned standalone anime episode and records it as a repack', () => {
    const result = matchFile('[sam] The Ghost in the Shell (2026) - 01v2 [WEB 1080p EAC-3] [27E6D99D].mkv', [
      { id: 'episode-1', season: 1, number: 1, title: 'Episode 01: Prologue' },
      { id: 'episode-2', season: 1, number: 2, title: 'Episode 02: Super Spartan' },
    ], true, .8, 'The Ghost in the Shell');

    expect(result.match?.episode.id).toBe('episode-1');
    expect(result.match?.reasons).toContain('episode number in the only matching season');
    expect(result.tags.flags).toContain('REPACK');
  });

  it('does not guess a season when a bare episode number is ambiguous', () => {
    const result = matchFile('Show - 07 [1080p].mkv', [
      { id: 's1e7', season: 1, number: 7, title: 'First Seven' },
      { id: 's2e7', season: 2, number: 7, title: 'Second Seven' },
    ], false);

    expect(result.match).toBeUndefined();
  });

  it('matches and groups a contiguous multi-episode filename', () => {
    const result = matchFile('Show.S01E01-E03.1080p.mkv', [
      { id: 'e1', season: 1, number: 1, title: 'One', runtimeMinutes: 22 },
      { id: 'e2', season: 1, number: 2, title: 'Two', runtimeMinutes: 22 },
      { id: 'e3', season: 1, number: 3, title: 'Three', runtimeMinutes: 22 },
    ], true, .8, 'Show', 66 * 60);

    expect(result.match?.episodes?.map((episode) => episode.id)).toEqual(['e1', 'e2', 'e3']);
    expect(result.match?.reasons).toContain('3 episode numbers');
    expect(result.match?.reasons).toContain('duration matches 66m runtime');
  });

  it.each(['Show.SP01.mkv', 'Show.Special.01.mkv', 'Show.OVA01.mkv', 'Show.OAD.01.mkv'])
    ('matches explicit special filename %s to season zero', (filename) => {
      const result = matchFile(filename, [{ id: 'special', season: 0, number: 1, title: 'Bonus Story' }]);
      expect(result.match?.episode.id).toBe('special');
      expect(result.match?.reasons).toContain('special episode number');
    });

  it('uses retained TVDB absolute order for a bare anime episode number', () => {
    const result = matchFile('Long Running Show - 037 [1080p].mkv', [
      { id: 's1e37', season: 1, number: 37, absoluteNumber: 50, title: 'Earlier Episode' },
      { id: 's2e11', season: 2, number: 11, absoluteNumber: 37, title: 'Current Episode' },
    ]);

    expect(result.match?.episode.id).toBe('s2e11');
    expect(result.match?.reasons).toContain('absolute episode number');
  });

  it('uses retained absolute order for an E-prefixed standalone episode number', () => {
    const result = matchFile('The Real Ghostbusters - E093 (Flipside).mp4', [
      { id: 's4e8', season: 4, number: 8, absoluteNumber: 93, title: 'Flipside' },
      { id: 's5e5', season: 5, number: 5, absoluteNumber: 110, title: 'Future Episode' },
    ], true, .8, 'The Real Ghostbusters');

    expect(result.match?.episode.id).toBe('s4e8');
    expect(result.match?.reasons).toContain('absolute episode number');
  });

  it('does not use the show title as episode-title evidence', () => {
    const result = matchFile('His.Dark.Materials.S01E04.1080p.BluRay.x265-RARBG.mp4', [
      { id: 'special', season: 0, number: 1, title: 'Making His Dark Materials' },
      { id: 'episode', season: 1, number: 4, title: 'Armour' },
    ], true, 0.8, 'His Dark Materials');

    expect(result.match?.episode.id).toBe('episode');
    expect(result.match?.score).toBeCloseTo(0.85);
    expect(result.match?.reasons).toEqual(['season and episode number', 'exact numbering with no conflicting episode title']);
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

    expect(numbered.match?.score).toBeCloseTo(.85);
    expect(numbered.status).toBe('confident');
    expect(durationOnly.match).toBeUndefined();
  });
});
