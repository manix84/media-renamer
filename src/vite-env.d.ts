/// <reference types="vite/client" />

import type { CompanionScan, Episode, MediaTechnicalTags, MovieDetails, MovieSearchResult, ProviderStatus, RenamePlanIssue, ShowDetails, ShowSearchResult } from './core/types';
import type { DebugEntry, DebugLevel } from './DebugConsole';

type RenameOperationRecord = {
  operation: {
    id: string;
    status: 'completed' | 'undone';
    items: Array<{ sourcePath: string; targetPath: string }>;
  };
  logPath: string;
};

declare global {
  interface Window {
    mediaRenamer?: {
      platform: string;
      pickFiles(): Promise<string[]>;
      pickFolders(): Promise<string[]>;
      pickDestinationFolder(kind?: 'TV' | 'Movie'): Promise<string | undefined>;
      expandPaths(paths: string[]): Promise<string[]>;
      pathForFile(file: File): string;
      probeMedia(filePath: string): Promise<MediaTechnicalTags>;
      discoverCompanions(paths: string[]): Promise<CompanionScan>;
      preflightRenamePlan(items: Array<{ sourcePath: string; targetPath: string }>): Promise<RenamePlanIssue[]>;
      resolveRenameCollisions(groups: Array<{ items: Array<{ sourcePath: string; targetPath: string }> }>): Promise<Array<{ items: Array<{ sourcePath: string; targetPath: string }> }>>;
      executeRenamePlan(groups: Array<{ items: Array<{ sourcePath: string; targetPath: string }> }>): Promise<RenameOperationRecord>;
      getLastRenameOperation(): Promise<RenameOperationRecord | undefined>;
      undoRenameOperation(operationId: string): Promise<RenameOperationRecord>;
      onRenameProgress(listener: (progress: { operation: 'rename' | 'undo'; completed: number; total: number }) => void): () => void;
      exportRenamePlan(plan: unknown): Promise<string | undefined>;
      providerStatus(): Promise<ProviderStatus>;
      searchShows(query: string): Promise<ShowSearchResult[]>;
      getShow(showId: string): Promise<ShowDetails>;
      getSeasonEpisodes(showId: string, season: number): Promise<Episode[]>;
      searchMovies(query: string): Promise<MovieSearchResult[]>;
      getMovie(movieId: string): Promise<MovieDetails>;
      openDebugConsole(): Promise<void>;
      dockDebugConsole(): Promise<void>;
      appendDebug(entry: { level: DebugLevel; message: string; detail?: string }): void;
      getDebugEntries(): Promise<DebugEntry[]>;
      clearDebugEntries(): Promise<void>;
      onDebugEntries(listener: (entries: DebugEntry[]) => void): () => void;
      onDebugDock(listener: () => void): () => void;
    };
  }
}
