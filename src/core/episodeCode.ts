export type ParsedEpisodeCode = { season: number; episode: number; index: number };
export type ParsedStandaloneEpisode = { episode: number; index: number };

const episodeCodePattern = /(?:^|[ ._-])(?:s(\d{1,2})[ ._-]*e(\d{1,3})|(\d{1,2})[ ._-]*x[ ._-]*(\d{1,3})|s(\d{1,2})[ ._-]+(\d{1,3}))(?=$|[ ._-])/i;
const standaloneEpisodePattern = /\s+-\s+(\d{1,3})(?=\s*(?:-|\[|\(|$))/;
const compactMultiEpisodePattern = /(?:^|[ ._-])s(\d{1,2})[ ._-]*e(\d{1,3})((?:[ ._-]*e\d{1,3})+)(?=$|[ ._-])/i;
const rangedMultiEpisodePattern = /(?:^|[ ._-])s(\d{1,2})[ ._-]*e(\d{1,3})[ ._-]+e?(\d{1,3})(?=$|[ ._-])/i;

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

export function parseEpisodeCodes(value: string): ParsedEpisodeCode[] {
  const ranged = rangedMultiEpisodePattern.exec(value);
  if (ranged) {
    const start = Number(ranged[2]);
    const end = Number(ranged[3]);
    if (end > start && end - start <= 20) {
      return Array.from({ length: end - start + 1 }, (_, offset) => ({ season: Number(ranged[1]), episode: start + offset, index: ranged.index }));
    }
  }
  const compact = compactMultiEpisodePattern.exec(value);
  if (compact) {
    const numbers = [Number(compact[2]), ...[...compact[3].matchAll(/e(\d{1,3})/gi)].map((match) => Number(match[1]))];
    return [...new Set(numbers)].map((episode) => ({ season: Number(compact[1]), episode, index: compact.index }));
  }
  const single = parseEpisodeCode(value);
  return single ? [single] : [];
}
