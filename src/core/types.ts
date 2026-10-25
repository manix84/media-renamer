export type Source = 'BluRay' | 'DVD' | 'WEB-DL' | 'WEBRip' | 'HDTV' | 'DVDRip' | 'TVRip' | 'Unknown';
export type ShowMetadataAgent = 'tvdb-aired' | 'tmdb-aired';

export interface MediaClassificationMetadata {
  genreIds?: number[];
  originalLanguage?: string;
  originCountries?: string[];
}

export interface Episode {
  id: string;
  season: number;
  number: number;
  absoluteNumber?: number;
  title: string;
  airDate?: string;
  runtimeMinutes?: number;
  overview?: string;
  imageUrl?: string;
}

export interface ShowSearchResult extends MediaClassificationMetadata {
  id: string;
  tvdbId?: string;
  name: string;
  year?: number;
  overview: string;
  posterUrl?: string;
  logoUrl?: string;
  backgroundUrl?: string;
  squareUrl?: string;
  bannerUrl?: string;
}

export interface SeasonSummary {
  number: number;
  name: string;
  episodeCount: number;
  airDate?: string;
  posterUrl?: string;
}

export interface ShowDetails extends ShowSearchResult {
  seasons: SeasonSummary[];
}

export interface MovieSearchResult extends MediaClassificationMetadata {
  id: string;
  mediaType?: 'movie' | 'tv';
  imdbId?: string;
  runtimeMinutes?: number;
  name: string;
  year?: number;
  overview: string;
  posterUrl?: string;
  logoUrl?: string;
  backgroundUrl?: string;
  squareUrl?: string;
  bannerUrl?: string;
  collection?: MovieCollection;
}

export interface MovieCollection {
  id: string;
  name: string;
}

export type MovieDetails = MovieSearchResult;

export type ExtensionPreferences = Record<string, { enabled: boolean; settings: Record<string, string>; grantedCapabilities?: string[] }>;

export interface SavedLibraryRoot {
  id: string;
  kind: 'shows' | 'movies';
  name: string;
  path: string;
  updatedAt: number;
}

export interface SavedBatchQueue {
  id: string;
  name: string;
  mediaType: 'shows' | 'movies';
  paths: string[];
  updatedAt: number;
}

export interface ProviderStatus {
  configured: boolean;
  tvdbConfigured: boolean;
}

export interface ReleaseTags {
  source: Source;
  edition?: string;
  editionError?: string;
  resolution?: string;
  videoCodec?: string;
  audioCodec?: string;
  channels?: string;
  flags: string[];
  group?: string;
  webOrigin?: string;
  webOriginShort?: string;
  audioLanguages?: AudioLanguage[];
}

export interface AudioLanguage { name: string; code3: string; code2?: string }

export type MediaTechnicalTags = Partial<Pick<ReleaseTags, 'resolution' | 'videoCodec' | 'audioCodec' | 'channels' | 'audioLanguages'>> & { durationSeconds?: number; embeddedTitle?: string };

export type CompanionKind = 'subtitle' | 'metadata' | 'artwork';
export interface MediaCompanion { path: string; suffix: string; kind: CompanionKind }
export interface AmbiguousCompanion { path: string; candidateVideoPaths: string[] }
export interface CompanionScan { byVideo: Record<string, MediaCompanion[]>; ambiguous: AmbiguousCompanion[] }

export interface MatchCandidate {
  episode: Episode;
  episodes?: Episode[];
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

export interface SavedMatchDecision {
  showId: string;
  filenameKey: string;
  episodeIds: string[];
  updatedAt: number;
}

export interface ShowRule {
  showId: string;
  titleMatching: boolean;
  confidenceThreshold: number;
  updatedAt: number;
}

export type RenameIssueSeverity = 'error' | 'warning';

export interface RenamePlanIssue {
  code: 'unresolved-match' | 'review-required' | 'ambiguous-companion' | 'invalid-destination' | 'invalid-filename' | 'duplicate-target' | 'no-change' | 'case-only-rename' | 'source-missing' | 'target-exists';
  severity: RenameIssueSeverity;
  message: string;
  sourcePath: string;
  targetPath?: string;
}

export interface RenameCompanionPlanItem {
  sourcePath: string;
  sourceName: string;
  targetPath?: string;
  targetName?: string;
  suffix: string;
  kind: CompanionKind;
  issues: RenamePlanIssue[];
}

export interface RenamePlanItem {
  sourcePath: string;
  sourceName: string;
  targetPath?: string;
  targetName?: string;
  matchStatus: FileMatch['status'] | 'pending';
  confidence: number;
  companions: RenameCompanionPlanItem[];
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
