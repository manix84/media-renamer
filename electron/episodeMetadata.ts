export type EpisodeMetadata = {
  id: string;
  season: number;
  number: number;
  title: string;
  overview?: string;
  imageUrl?: string;
};

export function mergeEpisodeArtwork<T extends EpisodeMetadata>(primary: T[], artwork: EpisodeMetadata[]): T[] {
  const byNumber = new Map(artwork.map((episode) => [`${episode.season}:${episode.number}`, episode]));
  return primary.map((episode) => {
    const fallback = byNumber.get(`${episode.season}:${episode.number}`);
    if (!fallback) return episode;
    return {
      ...episode,
      ...(!episode.imageUrl && fallback.imageUrl ? { imageUrl: fallback.imageUrl } : {}),
      ...(!episode.overview && fallback.overview ? { overview: fallback.overview } : {}),
    };
  });
}
