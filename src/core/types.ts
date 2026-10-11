export type Source = 'BluRay' | 'WEB-DL' | 'WEBRip' | 'HDTV' | 'DVDRip' | 'TVRip' | 'Unknown';

export interface Episode {
  id: string;
  season: number;
  number: number;
  title: string;
  airDate?: string;
}

export interface ReleaseTags {
  source: Source;
  resolution?: string;
  videoCodec?: string;
  audioCodec?: string;
  channels?: string;
  flags: string[];
  group?: string;
}

export interface MatchCandidate {
  episode: Episode;
  score: number;
  reasons: string[];
}

export interface FileMatch {
  path: string;
  filename: string;
  tags: ReleaseTags;
  match?: MatchCandidate;
  alternatives: MatchCandidate[];
  status: 'confident' | 'review' | 'unmatched';
}
