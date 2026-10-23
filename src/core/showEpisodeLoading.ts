import type { Episode, ShowMetadataAgent } from './types';

export type ShowEpisodeRequest = {
  agent: ShowMetadataAgent;
  tmdbId: string;
  tvdbId?: string;
  seasons: number[];
};

export type ShowEpisodeLoad = {
  episodes: Episode[];
  agent: ShowMetadataAgent;
  tvdbId?: string;
  fallbackReason?: string;
};

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export async function loadShowEpisodesWithFallback(
  request: ShowEpisodeRequest,
  load: (request: ShowEpisodeRequest) => Promise<Episode[]>,
): Promise<ShowEpisodeLoad> {
  try {
    return { episodes: await load(request), agent: request.agent, tvdbId: request.tvdbId };
  } catch (reason) {
    const message = errorMessage(reason);
    if (request.agent !== 'tvdb-aired' || !/TVDB episodes for series \d+ were not found\./i.test(message)) throw reason;
    const fallbackRequest = { ...request, agent: 'tmdb-aired' as const, tvdbId: undefined };
    return {
      episodes: await load(fallbackRequest),
      agent: 'tmdb-aired',
      fallbackReason: message,
    };
  }
}
