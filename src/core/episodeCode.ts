export type ParsedEpisodeCode = { season: number; episode: number; index: number };
export type ParsedStandaloneEpisode = { episode: number; index: number };

const episodeCodePattern = /(?:^|[ ._-])(?:s(\d{1,2})[ ._-]*e(\d{1,3})|(\d{1,2})[ ._-]*x[ ._-]*(\d{1,3})|s(\d{1,2})[ ._-]+(\d{1,3}))(?=$|[ ._-])/i;
const standaloneEpisodePattern = /\s+-\s+(\d{1,3})(?=\s*(?:-|\[|\(|$))/;

export function parseEpisodeCode(value: string): ParsedEpisodeCode | undefined {
  const match = episodeCodePattern.exec(value);
  if (!match) return undefined;
  return {
    season: Number(match[1] ?? match[3] ?? match[5]),
    episode: Number(match[2] ?? match[4] ?? match[6]),
    index: match.index,
  };
}

export function parseStandaloneEpisode(value: string): ParsedStandaloneEpisode | undefined {
  const match = standaloneEpisodePattern.exec(value);
  return match ? { episode: Number(match[1]), index: match.index } : undefined;
}
