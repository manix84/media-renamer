export type ParsedEpisodeCode = { season: number; episode: number; index: number };

const episodeCodePattern = /(?:^|[ ._-])(?:s(\d{1,2})[ ._-]*e(\d{1,3})|(\d{1,2})[ ._-]*x[ ._-]*(\d{1,3}))(?=$|[ ._-])/i;

export function parseEpisodeCode(value: string): ParsedEpisodeCode | undefined {
  const match = episodeCodePattern.exec(value);
  if (!match) return undefined;
  return {
    season: Number(match[1] ?? match[3]),
    episode: Number(match[2] ?? match[4]),
    index: match.index,
  };
}
