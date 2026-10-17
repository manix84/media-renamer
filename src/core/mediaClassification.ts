import { parseEpisodeCodes, parseSpecialEpisode, parseStandaloneEpisode } from './episodeCode';

export type InferredMediaKind = 'shows' | 'movies';
export type MediaFileKind = InferredMediaKind | 'ambiguous';

const explicitEpisodeWord = /(?:^|[ ._-])ep(?:isode)?\.?[ ._-]*\d{1,4}(?=$|[ ._-])/i;
const releaseEvidence = /\b(?:2160p|1080p|720p|576p|480p|uhd|hdr10?|web[ ._-]?(?:dl|rip)|blu[ ._-]?ray|b[dr]rip|hdtv|dvd[ ._-]?rip|remux|x26[45]|h26[45]|hevc|av1|aac|ac3|eac3|dts|truehd|atmos)\b/i;

function filenameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? filePath;
}

function hasTvEvidence(filename: string): boolean {
  return parseEpisodeCodes(filename).length > 0
    || Boolean(parseSpecialEpisode(filename))
    || Boolean(parseStandaloneEpisode(filename))
    || explicitEpisodeWord.test(filename);
}

function hasMovieEvidence(filename: string, latestYear: number): boolean {
  const years = [...filename.matchAll(/(?:^|[^0-9])((?:18|19|20)\d{2})(?![0-9])/g)]
    .filter((match) => Number(match[1]) <= latestYear);
  const year = years.at(-1);
  if (!year?.index) return false;
  const title = filename.slice(0, year.index).replace(/[._-]+/g, ' ').trim();
  const suffix = filename.slice(year.index + year[0].length).trim();
  return title.length >= 2 && (!suffix || releaseEvidence.test(suffix));
}

export function classifyMediaFile(path: string, currentYear = new Date().getFullYear()): MediaFileKind {
  const filename = filenameFromPath(path);
  const tv = hasTvEvidence(filename);
  const movie = hasMovieEvidence(filename, currentYear + 1);
  if (tv) return 'shows';
  if (movie) return 'movies';
  return 'ambiguous';
}

export function classifyMediaBatch(paths: string[], currentYear = new Date().getFullYear()): InferredMediaKind | undefined {
  if (!paths.length) return undefined;
  let shows = 0;
  let movies = 0;
  for (const path of paths) {
    const kind = classifyMediaFile(path, currentYear);
    if (kind === 'shows') shows += 1;
    if (kind === 'movies') movies += 1;
  }
  const majority = Math.ceil(paths.length / 2);
  if (shows >= majority && shows >= movies) return 'shows';
  if (movies >= majority && movies > shows) return 'movies';
  return undefined;
}
