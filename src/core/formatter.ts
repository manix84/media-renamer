import type { Episode, ReleaseTags } from './types';

export const PREVIOUS_DEFAULT_EPISODE_TEMPLATE = '{{show.name}}{{#show.year}} ({{show.year}}){{/show.year}} - {{episode.range}} - {{#episodes}}{{^first}}, {{/first}}{{title}}{{/episodes}}{{#technical}} [{{technical}}]{{/technical}}';
export const PREVIOUS_TVDB_DEFAULT_EPISODE_TEMPLATE = `${PREVIOUS_DEFAULT_EPISODE_TEMPLATE}{{#show.tvdbId}} {tvdb-{{show.tvdbId}}}{{/show.tvdbId}}`;
export const PREVIOUS_DEFAULT_MOVIE_FOLDER_TEMPLATE = '{{movie.name}}{{#movie.year}} ({{movie.year}}){{/movie.year}}';
export const PREVIOUS_DEFAULT_MOVIE_TEMPLATE = `{{movie.name}}{{#movie.year}} ({{movie.year}}){{/movie.year}}{{#technical}} [{{technical}}]{{/technical}}{{#movie.tmdbId}} {tmdb-{{movie.tmdbId}}}{{/movie.tmdbId}}`;
export const PREVIOUS_EDITION_DEFAULT_MOVIE_TEMPLATE = `{{movie.name}}{{#movie.year}} ({{movie.year}}){{/movie.year}}{{#release.edition}} {edition-{{release.edition}}}{{/release.edition}}{{#technical}} [{{technical}}]{{/technical}}{{#movie.tmdbId}} {tmdb-{{movie.tmdbId}}}{{/movie.tmdbId}}`;
export const DEFAULT_EPISODE_TEMPLATE = `{{show.name}}{{#show.year}} ({{show.year}}){{/show.year}} -
  {{episode.range}} -
  {{#episodes}}{{^first}}, {{/first}}{{title}}{{/episodes}}{{#technical}} [{{technical}}]{{/technical}}{{#show.tvdbId}} {tvdb-{{show.tvdbId}}}{{/show.tvdbId}}`;
export const DEFAULT_SHOW_FOLDER_TEMPLATE = '{{show.name}}{{#show.year}} ({{show.year}}){{/show.year}}';
export const DEFAULT_MOVIE_FOLDER_TEMPLATE = `{{movie.name}}{{#movie.year}} ({{movie.year}}){{/movie.year}}{{#movie.edition}} {edition-{{movie.edition}}}{{/movie.edition}}`;
export const DEFAULT_MOVIE_TEMPLATE = `{{movie.name}}
{{#movie.year}} ({{movie.year}}){{/movie.year}}
{{#technical}} [{{technical}}]{{/technical}}
{{#release.edition}} {edition-{{release.edition}}}{{/release.edition}}
{{#movie.tmdbId}} {tmdb-{{movie.tmdbId}}}{{/movie.tmdbId}}`;

type TemplateValue = string | number | boolean | TemplateContext[] | TemplateContext | undefined;
type TemplateContext = { [key: string]: TemplateValue };
type TemplateNode =
  | { type: 'text'; value: string }
  | { type: 'variable'; name: string }
  | { type: 'section'; name: string; inverted: boolean; children: TemplateNode[] };

const TOKEN = /{{\s*([#\/^]?)\s*([^{}]+?)\s*}}/g;
const VALID_NAMES = new Set([
  'show.name', 'show.year', 'show.tvdbId', 'episode.range', 'episodes', 'technical',
  'season', 'number', 'seasonPadded', 'numberPadded', 'code', 'title', 'first', 'last',
  'release.resolution', 'release.source', 'release.videoCodec', 'release.audioCodec',
  'release.channels', 'release.group', 'release.flags',
]);
const MOVIE_VALID_NAMES = new Set([
  'movie.name', 'movie.year', 'movie.tmdbId', 'movie.edition', 'technical',
  'release.resolution', 'release.source', 'release.videoCodec', 'release.audioCodec',
  'release.channels', 'release.group', 'release.flags', 'release.edition',
]);

function parseTemplate(template: string): TemplateNode[] {
  if (template.replace(TOKEN, '').includes('{{') || template.replace(TOKEN, '').includes('}}')) throw new Error('A template tag is not complete');
  const root: TemplateNode[] = [];
  const stack: Array<{ name: string; nodes: TemplateNode[] }> = [{ name: '', nodes: root }];
  let cursor = 0;

  for (const match of template.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) stack.at(-1)!.nodes.push({ type: 'text', value: template.slice(cursor, index) });
    const [, marker, rawName] = match;
    const name = rawName.trim();
    if (marker === '#' || marker === '^') {
      const node: TemplateNode = { type: 'section', name, inverted: marker === '^', children: [] };
      stack.at(-1)!.nodes.push(node);
      stack.push({ name, nodes: node.children });
    } else if (marker === '/') {
      if (stack.length === 1 || stack.at(-1)!.name !== name) throw new Error(`Unexpected closing section “${name}”`);
      stack.pop();
    } else {
      stack.at(-1)!.nodes.push({ type: 'variable', name });
    }
    cursor = index + match[0].length;
  }

  if (cursor < template.length) stack.at(-1)!.nodes.push({ type: 'text', value: template.slice(cursor) });
  if (stack.length > 1) throw new Error(`Section “${stack.at(-1)!.name}” is not closed`);
  return root;
}

function resolve(name: string, contexts: TemplateContext[]): TemplateValue {
  for (const context of contexts) {
    let value: TemplateValue = context;
    for (const part of name.split('.')) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) { value = undefined; break; }
      value = value[part];
    }
    if (value !== undefined) return value;
  }
  return undefined;
}

function renderNodes(nodes: TemplateNode[], contexts: TemplateContext[]): string {
  return nodes.map((node) => {
    if (node.type === 'text') return node.value;
    const value = resolve(node.name, contexts);
    if (node.type === 'variable') return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    const truthy = Array.isArray(value) ? value.length > 0 : Boolean(value);
    if (node.inverted) return truthy ? '' : renderNodes(node.children, contexts);
    if (Array.isArray(value)) return value.map((item) => renderNodes(node.children, [item, ...contexts])).join('');
    if (!truthy) return '';
    return renderNodes(node.children, typeof value === 'object' ? [value as TemplateContext, ...contexts] : contexts);
  }).join('');
}

function episodeRange(episodes: Episode[]): string {
  const first = episodes[0];
  if (!first) return '';
  const start = `S${String(first.season).padStart(2, '0')}E${String(first.number).padStart(2, '0')}`;
  if (episodes.length === 1) return start;
  return `${start}-${episodes.slice(1).map((episode) => `${episode.season === first.season ? '' : `S${String(episode.season).padStart(2, '0')}`}E${String(episode.number).padStart(2, '0')}`).join('-')}`;
}

function templateContext(show: string, year: number | undefined, tvdbId: string | undefined, episodes: Episode[], tags: ReleaseTags): TemplateContext {
  const technical = [tags.resolution, tags.source !== 'Unknown' ? tags.source : undefined, ...tags.flags, tags.videoCodec, tags.audioCodec, tags.channels]
    .filter(Boolean).join(' ');
  return {
    show: { name: show, year, tvdbId },
    episode: { range: episodeRange(episodes) },
    episodes: episodes.map((episode, index) => ({
      season: episode.season,
      number: episode.number,
      seasonPadded: String(episode.season).padStart(2, '0'),
      numberPadded: String(episode.number).padStart(2, '0'),
      code: `S${String(episode.season).padStart(2, '0')}E${String(episode.number).padStart(2, '0')}`,
      title: episode.title,
      first: index === 0,
      last: index === episodes.length - 1,
    })),
    technical,
    release: {
      resolution: tags.resolution,
      source: tags.source === 'Unknown' ? undefined : tags.source,
      videoCodec: tags.videoCodec,
      audioCodec: tags.audioCodec,
      channels: tags.channels,
      group: tags.group,
      flags: tags.flags.join(' '),
    },
  };
}

function releaseContext(tags: ReleaseTags): Pick<TemplateContext, 'technical' | 'release'> {
  const technicalFlags = tags.edition ? tags.flags.filter((flag) => flag !== 'EXTENDED') : tags.flags;
  return {
    technical: [tags.resolution, tags.source !== 'Unknown' ? tags.source : undefined, ...technicalFlags, tags.videoCodec, tags.audioCodec, tags.channels].filter(Boolean).join(' '),
    release: {
      edition: tags.edition,
      resolution: tags.resolution,
      source: tags.source === 'Unknown' ? undefined : tags.source,
      videoCodec: tags.videoCodec,
      audioCodec: tags.audioCodec,
      channels: tags.channels,
      group: tags.group,
      flags: tags.flags.join(' '),
    },
  };
}

function renderEpisode(template: string, show: string, year: number | undefined, episodes: Episode[], tags: ReleaseTags, tvdbId?: string): string {
  return renderNodes(parseTemplate(template), [templateContext(show, year, tvdbId, episodes, tags)])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function portableFilenameBase(value: string): string {
  const portable = value
    .replace(/\s*[:/\\|]+\s*/g, ' - ')
    .replace(/[<>"?*\u0000-\u001f]/g, '')
    .replace(/[\t ]+/g, ' ')
    .replace(/[ .]+$/g, '')
    .trim();
  const safe = portable || '_';
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(safe) ? `_${safe}` : safe;
}

export function formatEpisode(template: string, show: string, year: number | undefined, episode: Episode | Episode[], tags: ReleaseTags, tvdbId?: string): string {
  return renderEpisode(template, show, year, Array.isArray(episode) ? episode : [episode], tags, tvdbId);
}

export function formatEpisodeFilename(template: string, show: string, year: number | undefined, episode: Episode | Episode[], tags: ReleaseTags, extension: string, tvdbId?: string, maximumBytes = 255): string {
  const episodes = Array.isArray(episode) ? episode : [episode];
  const encoder = new TextEncoder();
  const filename = (items: Episode[]) => `${portableFilenameBase(renderEpisode(template, show, year, items, tags, tvdbId))}${extension}`;
  const full = filename(episodes);
  if (encoder.encode(full).length <= maximumBytes) return full;

  const titles = episodes.map((item) => Array.from(item.title));
  const renderWithLimit = (limit: number, ellipsis = true) => filename(episodes.map((item, index) => ({
    ...item,
    title: titles[index].length > limit ? `${titles[index].slice(0, limit).join('')}${ellipsis ? '…' : ''}` : item.title,
  })));

  let lower = 0;
  let upper = Math.max(0, ...titles.map((title) => title.length));
  let fitted: string | undefined;
  while (lower <= upper) {
    const limit = Math.floor((lower + upper) / 2);
    const candidate = renderWithLimit(limit);
    if (encoder.encode(candidate).length <= maximumBytes) {
      fitted = candidate;
      lower = limit + 1;
    } else upper = limit - 1;
  }

  return fitted ?? renderWithLimit(0, false);
}

export function formatShowFolder(template: string, show: string, year: number | undefined, tvdbId?: string, season?: number): string {
  const rendered = renderNodes(parseTemplate(template), [{
    show: { name: show, year, tvdbId },
    season,
    seasonPadded: season === undefined ? undefined : String(season).padStart(2, '0'),
    seasonFolder: season === undefined ? undefined : season === 0 ? 'Specials' : `Season ${season}`,
    isSpecial: season === 0,
  }])
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(' ')
    .replace(/[\t ]+/g, ' ').trim();
  return rendered.split(/[\\/]+/).map(portableFilenameBase).filter(Boolean).join('/');
}

export function formatMovieFolder(template: string, movie: string, year: number | undefined, tmdbId?: string, edition?: string): string {
  const rendered = renderNodes(parseTemplate(template), [{ movie: { name: movie, year, tmdbId, edition } }])
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(' ')
    .replace(/[\t ]+/g, ' ').trim();
  return rendered.split(/[\\/]+/).map(portableFilenameBase).filter(Boolean).join('/');
}

function insertMissingMovieEdition(rendered: string, movie: string, year: number | undefined, edition: string | undefined): string {
  if (!edition) return rendered;
  const marker = ` {edition-${edition}}`;
  const titleIndex = rendered.indexOf(movie);
  let insertion = titleIndex >= 0 ? titleIndex + movie.length : -1;
  if (insertion >= 0 && year !== undefined) {
    const yearIndex = rendered.indexOf(String(year), insertion);
    if (yearIndex >= 0) {
      insertion = yearIndex + String(year).length;
      if (rendered[insertion] === ')') insertion += 1;
    }
  }
  if (insertion < 0) {
    const qualityIndex = rendered.search(/\s(?:\[|\{tmdb-)/i);
    insertion = qualityIndex >= 0 ? qualityIndex : rendered.length;
  }
  return `${rendered.slice(0, insertion).trimEnd()}${marker}${rendered.slice(insertion)}`.trim();
}

export function formatMovie(template: string, movie: string, year: number | undefined, tags: ReleaseTags, tmdbId?: string): string {
  const rendered = renderNodes(parseTemplate(template), [{ movie: { name: movie, year, tmdbId }, ...releaseContext(tags) }])
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(' ')
    .replace(/[\t ]+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
  const templatePlacesEdition = /\{\{\s*[#^/]?\s*release\.edition\s*\}\}/i.test(template);
  return templatePlacesEdition ? rendered : insertMissingMovieEdition(rendered, movie, year, tags.edition);
}

export function formatMovieFilename(template: string, movie: string, year: number | undefined, tags: ReleaseTags, extension: string, tmdbId?: string, maximumBytes = 255): string {
  const encoder = new TextEncoder();
  const filename = (title: string) => `${portableFilenameBase(formatMovie(template, title, year, tags, tmdbId))}${extension}`;
  const full = filename(movie);
  if (encoder.encode(full).length <= maximumBytes) return full;
  const characters = Array.from(movie);
  let lower = 0;
  let upper = characters.length;
  let fitted: string | undefined;
  while (lower <= upper) {
    const limit = Math.floor((lower + upper) / 2);
    const candidate = filename(limit < characters.length ? `${characters.slice(0, limit).join('')}…` : movie);
    if (encoder.encode(candidate).length <= maximumBytes) { fitted = candidate; lower = limit + 1; }
    else upper = limit - 1;
  }
  return fitted ?? filename('_');
}

function validationError(template: string, validNames: Set<string>): string | undefined {
  const visit = (nodes: TemplateNode[]): string | undefined => {
    for (const node of nodes) {
      if (node.type !== 'text' && !validNames.has(node.name)) return `Unknown field “${node.name}”`;
      if (node.type === 'section') {
        const error = visit(node.children);
        if (error) return error;
      }
    }
    return undefined;
  };
  return visit(parseTemplate(template));
}

export function templateError(template: string): string | undefined {
  try {
    return validationError(template, VALID_NAMES);
  }
  catch (error) { return error instanceof Error ? error.message : String(error); }
}

export function showFolderTemplateError(template: string): string | undefined {
  try { return validationError(template, new Set(['show.name', 'show.year', 'show.tvdbId', 'season', 'seasonPadded', 'seasonFolder', 'isSpecial'])); }
  catch (error) { return error instanceof Error ? error.message : String(error); }
}

export function movieFolderTemplateError(template: string): string | undefined {
  try { return validationError(template, new Set(['movie.name', 'movie.year', 'movie.tmdbId', 'movie.edition'])); }
  catch (error) { return error instanceof Error ? error.message : String(error); }
}

export function movieTemplateError(template: string): string | undefined {
  try { return validationError(template, MOVIE_VALID_NAMES); }
  catch (error) { return error instanceof Error ? error.message : String(error); }
}
