import type { Source } from './types';

export type EditableEpisodeMetadata = { id: string; season: string; number: string; title: string };

export type MediaMetadataOverride = {
  name: string;
  year: string;
  providerId: string;
  episodes: EditableEpisodeMetadata[];
  edition: string;
  resolution: string;
  source: Source;
  videoCodec: string;
  audioCodec: string;
  channels: string;
  webOrigin: string;
  webOriginShort: string;
  group: string;
  flags: string;
};

export function optionalMetadataNumber(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
}

export function validateMediaMetadata(draft: MediaMetadataOverride, movies: boolean): string | undefined {
  if (!draft.name.trim()) return `${movies ? 'Movie' : 'Show'} title is required.`;
  if (draft.year.trim() && !/^(?:18|19|20)\d{2}$/.test(draft.year.trim())) return 'Year must be a four-digit year from 1800 to 2099.';
  if (draft.providerId.trim() && !/^\d+$/.test(draft.providerId.trim())) return `${movies ? 'TMDB' : 'TVDB'} ID must contain digits only.`;
  if (draft.edition.includes('{') || draft.edition.includes('}')) return 'Edition names cannot contain braces.';
  for (const episode of draft.episodes) {
    if (!/^\d+$/.test(episode.season.trim()) || Number(episode.season) < 0) return 'Episode seasons must be zero or greater.';
    if (!/^\d+$/.test(episode.number.trim()) || Number(episode.number) < 1) return 'Episode numbers must be one or greater.';
    if (!episode.title.trim()) return 'Every episode title is required.';
  }
  return undefined;
}
