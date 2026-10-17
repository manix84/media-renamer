import { describe, expect, it } from 'vitest';
import { DEFAULT_EPISODE_TEMPLATE, DEFAULT_MOVIE_FOLDER_TEMPLATE, DEFAULT_MOVIE_TEMPLATE, DEFAULT_SHOW_FOLDER_TEMPLATE, formatEpisode, formatEpisodeFilename, formatMovie, formatMovieFilename, formatMovieFolder, formatShowFolder, movieFolderTemplateError, movieTemplateError, showFolderTemplateError, templateError } from './formatter';
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

  it('truncates episode titles by bytes while preserving protected filename data', () => {
    const longEpisode = { ...episodes[0], title: 'A very long 🚀 episode title '.repeat(20) };
    const filename = formatEpisodeFilename(DEFAULT_EPISODE_TEMPLATE, 'Protected Show Name', 2026, longEpisode, tags, '.mkv', '74550');
    expect(new TextEncoder().encode(filename).length).toBeLessThanOrEqual(255);
    expect(filename).toContain('Protected Show Name (2026)');
    expect(filename).toContain('[1080p WEB-DL H.264 AAC 2.0]');
    expect(filename).toContain('{tvdb-74550}.mkv');
    expect(filename).toContain('…');
  });

  it('truncates each merged episode title without truncating the suffix', () => {
    const merged = episodes.map((episode) => ({ ...episode, title: episode.title.repeat(40) }));
    const filename = formatEpisodeFilename(DEFAULT_EPISODE_TEMPLATE, 'Show', undefined, merged, tags, '.mkv', '74550');
    expect(new TextEncoder().encode(filename).length).toBeLessThanOrEqual(255);
    expect(filename.match(/…/g)).toHaveLength(2);
    expect(filename).toContain('[1080p WEB-DL H.264 AAC 2.0] {tvdb-74550}.mkv');
  });

  it('can reserve a smaller byte budget for longer companion suffixes', () => {
    const longEpisode = { ...episodes[0], title: 'A long episode title '.repeat(30) };
    const filename = formatEpisodeFilename(DEFAULT_EPISODE_TEMPLATE, 'Show', 2026, longEpisode, tags, '.mkv', '74550', 240);
    const companion = `${filename.slice(0, -4)}.en.forced.srt`;
    expect(new TextEncoder().encode(filename).length).toBeLessThanOrEqual(240);
    expect(new TextEncoder().encode(companion).length).toBeLessThanOrEqual(255);
  });

  it('generates portable filenames using Windows-compatible character rules', () => {
    const unsafeEpisode = { ...episodes[0], title: 'Who? / What* <Again>.' };
    expect(formatEpisodeFilename(DEFAULT_EPISODE_TEMPLATE, 'Star Trek: Voyager', 1995, unsafeEpisode, tags, '.mkv', '74550'))
      .toBe('Star Trek - Voyager (1995) - S01E01 - Who - What Again. [1080p WEB-DL H.264 AAC 2.0] {tvdb-74550}.mkv');
  });

  it('guards Windows device names and trailing periods', () => {
    expect(formatEpisodeFilename('{{show.name}}', 'CON.', undefined, episodes[0], tags, '.mkv'))
      .toBe('_CON.mkv');
  });

  it('formats portable show folders and optional nested paths', () => {
    expect(formatShowFolder(DEFAULT_SHOW_FOLDER_TEMPLATE, 'Star Trek: Voyager', 1995, '74550')).toBe('Star Trek - Voyager (1995)');
    expect(formatShowFolder('TV/{{show.name}}/{{show.year}}', 'Show', 2026)).toBe('TV/Show/2026');
    expect(formatShowFolder('{{show.name}} ({{show.year}})/Season {{season}}', 'The Simpsons', 1989, '71663', 5)).toBe('The Simpsons (1989)/Season 5');
    expect(formatShowFolder('{{show.name}}/Season {{seasonPadded}}', 'The Simpsons', 1989, '71663', 5)).toBe('The Simpsons/Season 05');
    expect(formatShowFolder('{{show.name}}/{{seasonFolder}}', 'The Simpsons', 1989, '71663', 0)).toBe('The Simpsons/Specials');
    expect(formatShowFolder('{{show.name}}/{{seasonFolder}}', 'The Simpsons', 1989, '71663', 5)).toBe('The Simpsons/Season 5');
    expect(formatShowFolder('{{#isSpecial}}Bonus Features{{/isSpecial}}{{^isSpecial}}Season {{season}}{{/isSpecial}}', 'The Simpsons', 1989, '71663', 0)).toBe('Bonus Features');
    expect(showFolderTemplateError('{{episode.range}}')).toBe('Unknown field “episode.range”');
  });

  it('formats and validates movie folders independently from shows', () => {
    expect(formatMovieFolder(DEFAULT_MOVIE_FOLDER_TEMPLATE, 'Blade Runner: 2049', 2017, '335984')).toBe('Blade Runner - 2049 (2017)');
    expect(formatMovieFolder(DEFAULT_MOVIE_FOLDER_TEMPLATE, 'Blade Runner', 1982, '78', "Director's Cut")).toBe("Blade Runner (1982) {edition-Director's Cut}");
    expect(formatMovieFolder('Movies/{{movie.name}} {tmdb-{{movie.tmdbId}}}', 'Arrival', 2016, '329865')).toBe('Movies/Arrival {tmdb-329865}');
    expect(movieFolderTemplateError('{{show.name}}')).toBe('Unknown field “show.name”');
  });

  it('formats and validates movie filenames independently from episodes', () => {
    expect(formatMovie(DEFAULT_MOVIE_TEMPLATE, 'Blade Runner: 2049', 2017, tags, '335984'))
      .toBe('Blade Runner: 2049 (2017) [1080p WEB-DL H.264 AAC 2.0] {tmdb-335984}');
    expect(movieTemplateError('{{episode.range}}')).toBe('Unknown field “episode.range”');
  });

  it('exposes full and shorthand web origins plus the release group to templates', () => {
    const releaseTags: ReleaseTags = { ...tags, webOrigin: 'Netflix', webOriginShort: 'NF', group: 'QxR' };
    expect(formatMovie('{{movie.name}} [{{release.webOrigin}} {{release.webOriginShort}} {{release.group}}]', 'Movie', 2026, releaseTags))
      .toBe('Movie [Netflix NF QxR]');
    expect(movieTemplateError('{{release.webOrigin}} {{release.webOriginShort}}')).toBeUndefined();
  });

  it('exposes audio languages as full names, code lists, and repeating entries', () => {
    const languageTags: ReleaseTags = { ...tags, audioLanguages: [
      { name: 'English', code3: 'eng', code2: 'en' },
      { name: 'Japanese', code3: 'jpn', code2: 'ja' },
    ] };
    const template = '{{movie.name}} [{{audio.languageNames}}] [{{audio.languageCodes3}}] [{{audio.languageCodes2}}] {{#audio.languages}}{{^first}} + {{/first}}{{name}}/{{code3}}/{{code2}}{{/audio.languages}}';
    expect(formatMovie(template, 'Movie', 2026, languageTags)).toBe('Movie [English, Japanese] [eng, jpn] [en, ja] English/eng/en + Japanese/jpn/ja');
    expect(movieTemplateError(template)).toBeUndefined();
  });

  it('writes a detected Plex edition without duplicating its extended flag', () => {
    const editionTags: ReleaseTags = { ...tags, edition: 'Extended', flags: ['EXTENDED'] };
    expect(formatMovie(DEFAULT_MOVIE_TEMPLATE, 'The Movie', 2020, editionTags, '123'))
      .toBe('The Movie (2020) [1080p WEB-DL H.264 AAC 2.0] {edition-Extended} {tmdb-123}');
  });

  it('canonicalizes movie editions again when formatting filenames and folders', () => {
    const editionTags: ReleaseTags = { ...tags, edition: 'Directors Cut' };
    expect(formatMovie(DEFAULT_MOVIE_TEMPLATE, 'Movie', 2020, editionTags, '123'))
      .toContain("{edition-Director's Cut}");
    expect(formatMovieFolder(DEFAULT_MOVIE_FOLDER_TEMPLATE, 'Movie', 2020, '123', 'Directors Cut'))
      .toBe("Movie (2020) {edition-Director's Cut}");
  });

  it('protects the Plex edition marker when an older custom template omits the edition field', () => {
    const previousCustomTemplate = '{{movie.name}}\n{{#movie.year}} ({{movie.year}}){{/movie.year}}\n{{#technical}} [{{technical}}]{{/technical}}\n{{#movie.tmdbId}} {tmdb-{{movie.tmdbId}}}{{/movie.tmdbId}}';
    const editionTags: ReleaseTags = { ...tags, edition: "Director's Cut" };
    expect(formatMovie(previousCustomTemplate, 'Elektra', 2005, editionTags, '9947'))
      .toBe("Elektra (2005) {edition-Director's Cut} [1080p WEB-DL H.264 AAC 2.0] {tmdb-9947}");
  });

  it('respects explicit custom placement of the movie edition', () => {
    const customTemplate = '{{movie.name}}\n{{#movie.year}} ({{movie.year}}){{/movie.year}}\n{{#technical}} [{{technical}}]{{/technical}}\n{{#movie.tmdbId}} {tmdb-{{movie.tmdbId}}}{{/movie.tmdbId}}\n{{#release.edition}} {edition-{{release.edition}}}{{/release.edition}}';
    const editionTags: ReleaseTags = { ...tags, edition: "Director's Cut" };
    expect(formatMovie(customTemplate, 'Elektra', 2005, editionTags, '9947'))
      .toBe("Elektra (2005) [1080p WEB-DL H.264 AAC 2.0] {tmdb-9947} {edition-Director's Cut}");
  });

  it('creates portable byte-bounded movie filenames without dropping technical data or the TMDB ID', () => {
    const filename = formatMovieFilename(DEFAULT_MOVIE_TEMPLATE, `A Movie: ${'Very '.repeat(80)}Long`, 2026, tags, '.mkv', '123456', 180);
    expect(new TextEncoder().encode(filename).length).toBeLessThanOrEqual(180);
    expect(filename).toContain('[1080p WEB-DL H.264 AAC 2.0]');
    expect(filename).toContain('{tmdb-123456}.mkv');
    expect(filename).not.toContain(':');
  });

  it('reports mismatched sections', () => {
    expect(templateError('{{#episodes}}{{title}}{{/show.year}}')).toBe('Unexpected closing section “show.year”');
  });

  it('reports incomplete tags and unknown fields', () => {
    expect(templateError('{{show.name')).toBe('A template tag is not complete');
    expect(templateError('{{show.title}}')).toBe('Unknown field “show.title”');
  });
});
