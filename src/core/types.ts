export type Source = 'BluRay' | 'DVD' | 'WEB-DL' | 'WEBRip' | 'HDTV' | 'DVDRip' | 'TVRip' | 'Unknown';

export interface Episode {
  id: string;
  season: number;
  number: number;
  title: string;
  airDate?: string;
}

export interface ShowSearchResult {
  id: string;
  tvdbId?: string;
  name: string;
  year?: number;
  overview: string;
  posterUrl?: string;
}

export interface SeasonSummary {
  number: number;
  name: string;
  episodeCount: number;
  airDate?: string;
}

export interface ShowDetails extends ShowSearchResult {
  seasons: SeasonSummary[];
}

export interface ProviderStatus {
  configured: boolean;
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

export type MediaTechnicalTags = Partial<Pick<ReleaseTags, 'resolution' | 'videoCodec' | 'audioCodec' | 'channels'>>;

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

export type RenameIssueSeverity = 'error' | 'warning';

export interface RenamePlanIssue {
  code: 'unresolved-match' | 'review-required' | 'invalid-destination' | 'invalid-filename' | 'duplicate-target' | 'no-change' | 'case-only-rename' | 'source-missing' | 'target-exists';
  severity: RenameIssueSeverity;
  message: string;
  sourcePath: string;
  targetPath?: string;
}

export interface RenamePlanItem {
  sourcePath: string;
  sourceName: string;
  targetPath?: string;
  targetName?: string;
  matchStatus: FileMatch['status'] | 'pending';
  confidence: number;
  issues: RenamePlanIssue[];
}

export interface RenamePlan {
  version: 1;
  items: RenamePlanItem[];
  destinationDirectories: string[];
  issues: RenamePlanIssue[];
  readyCount: number;
  blockedCount: number;
  warningCount: number;
}
