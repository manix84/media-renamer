export type EpisodeMetadata = {
  id: string;
  season: number;
  number: number;
  title: string;
  alternateTitles?: string[];
  overview?: string;
  imageUrl?: string;
};

export function mergeEpisodeArtwork<T extends EpisodeMetadata>(primary: T[], artwork: EpisodeMetadata[]): T[] {
  const byNumber = new Map(artwork.map((episode) => [`${episode.season}:${episode.number}`, episode]));
  return primary.map((episode) => {
    const fallback = byNumber.get(`${episode.season}:${episode.number}`);
    if (!fallback) return episode;
    const alternateTitles = [...new Set([
      ...(episode.alternateTitles ?? []),
      ...(fallback.alternateTitles ?? []),
      fallback.title,
    ].map((title) => title.trim()).filter((title) => title && title.localeCompare(episode.title, undefined, { sensitivity: 'accent' }) !== 0))];
    return {
      ...episode,
      ...(alternateTitles.length ? { alternateTitles } : {}),
      ...(!episode.imageUrl && fallback.imageUrl ? { imageUrl: fallback.imageUrl } : {}),
      ...(!episode.overview && fallback.overview ? { overview: fallback.overview } : {}),
    };
  });
}
