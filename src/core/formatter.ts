import type { Episode, ReleaseTags } from './types';

export function formatEpisode(show: string, year: number | undefined, episode: Episode, tags: ReleaseTags): string {
  const season = String(episode.season).padStart(2, '0');
  const number = String(episode.number).padStart(2, '0');
  const technical = [tags.resolution, tags.source !== 'Unknown' ? tags.source : undefined, ...tags.flags, tags.videoCodec]
    .filter(Boolean).join(' ');
  return `${show}${year ? ` (${year})` : ''} - S${season}E${number} - ${episode.title}${technical ? ` [${technical}]` : ''}`;
}
