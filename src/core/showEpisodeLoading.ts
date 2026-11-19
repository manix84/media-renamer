import type { Episode, ShowMetadataAgent } from './types';

export type ShowEpisodeRequest = {
  agent: ShowMetadataAgent;
  tmdbId: string;
  tvdbId?: string;
  seasons: number[];
  language?: string;
};

export type ShowEpisodeLoad = {
  episodes: Episode[];
  agent: ShowMetadataAgent;
  tvdbId?: string;
};

export async function loadShowEpisodesWithFallback(
  request: ShowEpisodeRequest,
  load: (request: ShowEpisodeRequest) => Promise<Episode[]>,
): Promise<ShowEpisodeLoad> {
  return { episodes: await load(request), agent: request.agent, tvdbId: request.tvdbId };
}
