import type { Episode, MovieDetails, ShowDetails } from './types';

export type PlexGeneratedAsset = { targetPath: string; content?: string; url?: string; groupIndex?: number };

function escapeXml(value: string | number | undefined): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function tag(name: string, value: string | number | undefined, attributes = ''): string {
  return value === undefined || value === '' ? '' : `  <${name}${attributes}>${escapeXml(value)}</${name}>\n`;
}

function uniqueId(type: string, value: string | undefined, primary = false): string {
  return value ? tag('uniqueid', value, ` type="${type}"${primary ? ' default="true"' : ''}`) : '';
}

export function movieNfo(movie: MovieDetails): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<movie>\n${tag('title', movie.name)}${tag('plot', movie.overview)}${uniqueId('tmdb', movie.id, true)}${uniqueId('imdb', movie.imdbId)}</movie>\n`;
}

function episodeBlock(episode: Episode): string {
  return `<episodedetails>\n${tag('title', episode.title)}${tag('season', episode.season)}${tag('episode', episode.number)}${tag('plot', episode.overview)}${tag('aired', episode.airDate)}${uniqueId('tvdb', episode.id, true)}</episodedetails>\n`;
}

export function episodeNfo(episodes: Episode[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n${episodes.map(episodeBlock).join('')}`;
}

export function showNfo(show: ShowDetails): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<tvshow>\n${tag('title', show.name)}${tag('plot', show.overview)}${uniqueId('tvdb', show.tvdbId, true)}${uniqueId('tmdb', show.id, !show.tvdbId)}</tvshow>\n`;
}

function extensionForUrl(url: string): string {
  const extension = new URL(url).pathname.match(/\.(jpe?g|png|tbn)$/i)?.[1]?.toLowerCase();
  return extension === 'jpeg' ? 'jpg' : extension ?? 'jpg';
}

function join(directory: string, filename: string): string {
  const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
  return `${directory.replace(/[\\/]+$/, '')}${separator}${filename}`;
}

function stem(filePath: string): string {
  const filename = filePath.split(/[\\/]/).pop() ?? filePath;
  return filename.replace(/\.[^./\\]+$/, '');
}

export function plexArtworkAssets(directory: string, artwork: { posterUrl?: string; backgroundUrl?: string; logoUrl?: string; squareUrl?: string; bannerUrl?: string }): PlexGeneratedAsset[] {
  const assets: PlexGeneratedAsset[] = [];
  if (artwork.posterUrl) assets.push({ targetPath: join(directory, `poster.${extensionForUrl(artwork.posterUrl)}`), url: artwork.posterUrl });
  if (artwork.backgroundUrl) assets.push({ targetPath: join(directory, `background.${extensionForUrl(artwork.backgroundUrl)}`), url: artwork.backgroundUrl });
  if (artwork.logoUrl) assets.push({ targetPath: join(directory, `logo.${extensionForUrl(artwork.logoUrl)}`), url: artwork.logoUrl });
  if (artwork.squareUrl) assets.push({ targetPath: join(directory, `square.${extensionForUrl(artwork.squareUrl)}`), url: artwork.squareUrl });
  if (artwork.bannerUrl) assets.push({ targetPath: join(directory, `banner.${extensionForUrl(artwork.bannerUrl)}`), url: artwork.bannerUrl });
  return assets;
}

export function plexSeasonArtworkAsset(directory: string, season: number, posterUrl: string): PlexGeneratedAsset {
  const name = season === 0 ? 'season-specials-poster' : `Season${String(season).padStart(2, '0')}`;
  return { targetPath: join(directory, `${name}.${extensionForUrl(posterUrl)}`), url: posterUrl };
}

export function plexMovieArtworkAssets(videoPath: string, artwork: { posterUrl?: string; backgroundUrl?: string; logoUrl?: string; squareUrl?: string; bannerUrl?: string }, inOwnFolder: boolean): PlexGeneratedAsset[] {
  if (inOwnFolder) return plexArtworkAssets(parentDirectory(videoPath), artwork);
  const directory = parentDirectory(videoPath);
  const name = stem(videoPath);
  const assets: PlexGeneratedAsset[] = [];
  if (artwork.posterUrl) assets.push({ targetPath: join(directory, `${name}.${extensionForUrl(artwork.posterUrl)}`), url: artwork.posterUrl });
  if (artwork.backgroundUrl) assets.push({ targetPath: join(directory, `${name}-fanart.${extensionForUrl(artwork.backgroundUrl)}`), url: artwork.backgroundUrl });
  if (artwork.logoUrl) assets.push({ targetPath: join(directory, `${name}-clearlogo.${extensionForUrl(artwork.logoUrl)}`), url: artwork.logoUrl });
  if (artwork.squareUrl) assets.push({ targetPath: join(directory, `${name}-squareArt.${extensionForUrl(artwork.squareUrl)}`), url: artwork.squareUrl });
  return assets;
}

export function plexShowDirectories(targetDirectory: string): { showRoot: string; seasonDirectory: string } {
  const separator = targetDirectory.includes('\\') && !targetDirectory.includes('/') ? '\\' : '/';
  const rootPrefix = targetDirectory.startsWith(separator) ? separator : '';
  const parts = targetDirectory.split(/[\\/]/).filter(Boolean);
  const seasonIndex = parts.findIndex((part) => /^(?:Season\s*\d+|Specials)$/i.test(part));
  if (seasonIndex < 0) return { showRoot: targetDirectory, seasonDirectory: targetDirectory };
  return {
    showRoot: `${rootPrefix}${parts.slice(0, seasonIndex).join(separator)}`,
    seasonDirectory: `${rootPrefix}${parts.slice(0, seasonIndex + 1).join(separator)}`,
  };
}

export function siblingPath(filePath: string, extension: string): string {
  return filePath.replace(/\.[^./\\]+$/, extension);
}

export function parentDirectory(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return index < 0 ? '' : filePath.slice(0, index);
}
