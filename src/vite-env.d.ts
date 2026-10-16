/// <reference types="vite/client" />

import type { CompanionScan, Episode, MediaTechnicalTags, MovieDetails, MovieSearchResult, ProviderStatus, RenamePlanIssue, ShowDetails, ShowMetadataAgent, ShowSearchResult } from './core/types';
import type { DebugEntry, DebugLevel } from './DebugConsole';

type RenameOperationRecord = {
  operation: {
    id: string;
    status: 'completed' | 'stopped' | 'undone';
    items: Array<{ sourcePath: string; targetPath: string }>;
    removedSourceDirectories?: string[];
    sourceDirectoryCleanupWarnings?: string[];
    externalLogPath?: string;
    externalLogWarning?: string;
  };
  logPath: string;
};

declare global {
  interface Window {
    mediaRenamer?: {
      platform: string;
      loadPreferences(): Promise<{
        autoClearCompletedBatch?: boolean;
        completionChime?: boolean;
        completionReport?: boolean;
        createExternalRenameLog?: boolean;
        episodeTemplate?: string;
        fileViewMode?: 'detailed' | 'summary' | 'compact';
        languagePreference?: 'system' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt-BR' | 'ja' | 'ko' | 'zh-CN';
        matchConfidenceThreshold?: number;
        movieBaseFolder?: string;
        movieFolderTemplate?: string;
        movieTemplate?: string;
        removeEmptySourceParents?: boolean;
        renameLogFolder?: string;
        showFolderTemplate?: string;
        themePalette?: 'classic' | 'ocean' | 'forest' | 'rose' | 'amber' | 'halloween' | 'christmas';
        themePreference?: 'system' | 'light' | 'dark';
        titleMatching?: boolean;
        tvBaseFolder?: string;
      }>;
      savePreferences(preferences: {
        autoClearCompletedBatch?: boolean;
        completionChime?: boolean;
        completionReport?: boolean;
        createExternalRenameLog?: boolean;
        episodeTemplate?: string;
        fileViewMode?: 'detailed' | 'summary' | 'compact';
        languagePreference?: 'system' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt-BR' | 'ja' | 'ko' | 'zh-CN';
        matchConfidenceThreshold?: number;
        movieBaseFolder?: string;
        movieFolderTemplate?: string;
        movieTemplate?: string;
        removeEmptySourceParents?: boolean;
        renameLogFolder?: string;
        showFolderTemplate?: string;
        themePalette?: 'classic' | 'ocean' | 'forest' | 'rose' | 'amber' | 'halloween' | 'christmas';
        themePreference?: 'system' | 'light' | 'dark';
        titleMatching?: boolean;
        tvBaseFolder?: string;
      }): Promise<void>;
      pickFiles(): Promise<string[]>;
      pickFolders(): Promise<string[]>;
      pickDestinationFolder(kind?: 'TV' | 'Movie' | 'Log'): Promise<string | undefined>;
      expandPaths(paths: string[]): Promise<string[]>;
      watchFiles(paths: string[]): Promise<void>;
      onWatchedFilesChanged(listener: (changes: Array<{ type: 'moved'; previousPath: string; path: string } | { type: 'deleted'; path: string }>) => void): () => void;
      pathForFile(file: File): string;
      probeMedia(filePath: string): Promise<MediaTechnicalTags>;
      discoverCompanions(paths: string[]): Promise<CompanionScan>;
      preflightRenamePlan(items: Array<{ sourcePath: string; targetPath: string }>): Promise<RenamePlanIssue[]>;
      resolveRenameCollisions(groups: Array<{ items: Array<{ sourcePath: string; targetPath: string }> }>): Promise<Array<{ items: Array<{ sourcePath: string; targetPath: string }> }>>;
      executeRenamePlan(groups: Array<{ items: Array<{ sourcePath: string; targetPath: string }> }>, options?: { removeEmptySourceParents?: boolean; createExternalLog?: boolean; externalLogDirectory?: string }): Promise<RenameOperationRecord>;
      controlRename(control: 'stop' | 'undo'): Promise<boolean>;
      getLastRenameOperation(): Promise<RenameOperationRecord | undefined>;
      undoRenameOperation(operationId: string): Promise<RenameOperationRecord>;
      onRenameProgress(listener: (progress: { operation: 'rename' | 'undo'; completed: number; total: number }) => void): () => void;
      exportRenamePlan(plan: unknown): Promise<string | undefined>;
      providerStatus(): Promise<ProviderStatus>;
      searchShows(query: string): Promise<ShowSearchResult[]>;
      getShow(showId: string): Promise<ShowDetails>;
      resolveTvdbSeries(request: { name: string; year?: number }): Promise<{ id: string; name: string; year?: number } | undefined>;
      getShowEpisodes(request: { agent: ShowMetadataAgent; tmdbId: string; tvdbId?: string; seasons: number[] }): Promise<Episode[]>;
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
