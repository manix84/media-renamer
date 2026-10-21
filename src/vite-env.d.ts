/// <reference types="vite/client" />

import type { CompanionScan, Episode, MediaTechnicalTags, MovieDetails, MovieSearchResult, ProviderStatus, RenamePlanIssue, SavedBatchQueue, SavedLibraryRoot, SavedMatchDecision, ShowDetails, ShowMetadataAgent, ShowRule, ShowSearchResult } from './core/types';
import type { DebugEntry, DebugLevel } from './DebugConsole';

type RenameOperationRecord = {
  operation: {
    id: string;
    status: 'completed' | 'stopped' | 'undone';
    items: Array<{ sourcePath: string; targetPath: string }>;
    removedSourceJunkFiles?: string[];
    removedSourceDirectories?: string[];
    sourceDirectoryCleanupWarnings?: string[];
    externalLogPath?: string;
    externalLogWarning?: string;
  };
  logPath: string;
};

declare global {
  const __APP_VERSION__: string;
  interface Window {
    mediaRenamer?: {
      platform: string;
      getAppVersion(): Promise<string>;
      loadPreferences(): Promise<{
        autoClearCompletedBatch?: boolean;
        completionChime?: boolean;
        completionReport?: boolean;
        completionReportAutoClose?: boolean;
        clearSourceJunk?: boolean;
        createExternalRenameLog?: boolean;
        developerMode?: boolean;
        exportNfo?: boolean;
        exportPlexArtwork?: boolean;
        episodeTemplate?: string;
        fileViewMode?: 'detailed' | 'summary' | 'compact';
        languagePreference?: 'system' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt-BR' | 'ja' | 'ko' | 'zh-CN';
        matchConfidenceThreshold?: number;
        movieBaseFolder?: string;
        movieFolderTemplate?: string;
        movieTemplate?: string;
        removeEmptySourceParents?: boolean;
        releaseAliasText?: string;
        savedMatchDecisions?: SavedMatchDecision[];
        savedLibraryRoots?: SavedLibraryRoot[];
        savedBatchQueues?: SavedBatchQueue[];
        showRules?: ShowRule[];
        renameLogFolder?: string;
        showFolderTemplate?: string;
        themePalette?: 'classic' | 'ocean' | 'forest' | 'rose' | 'amber' | 'valentines' | 'pride' | 'bonfire' | 'new-year' | 'spring' | 'summer' | 'autumn' | 'winter' | 'halloween' | 'christmas';
        themePreference?: 'system' | 'light' | 'dark';
        titleMatching?: boolean;
        tvBaseFolder?: string;
      }>;
      savePreferences(preferences: {
        autoClearCompletedBatch?: boolean;
        completionChime?: boolean;
        completionReport?: boolean;
        completionReportAutoClose?: boolean;
        clearSourceJunk?: boolean;
        createExternalRenameLog?: boolean;
        developerMode?: boolean;
        exportNfo?: boolean;
        exportPlexArtwork?: boolean;
        episodeTemplate?: string;
        fileViewMode?: 'detailed' | 'summary' | 'compact';
        languagePreference?: 'system' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt-BR' | 'ja' | 'ko' | 'zh-CN';
        matchConfidenceThreshold?: number;
        movieBaseFolder?: string;
        movieFolderTemplate?: string;
        movieTemplate?: string;
        removeEmptySourceParents?: boolean;
        releaseAliasText?: string;
        savedMatchDecisions?: SavedMatchDecision[];
        savedLibraryRoots?: SavedLibraryRoot[];
        savedBatchQueues?: SavedBatchQueue[];
        showRules?: ShowRule[];
        renameLogFolder?: string;
        showFolderTemplate?: string;
        themePalette?: 'classic' | 'ocean' | 'forest' | 'rose' | 'amber' | 'valentines' | 'pride' | 'bonfire' | 'new-year' | 'spring' | 'summer' | 'autumn' | 'winter' | 'halloween' | 'christmas';
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
      stageGeneratedSidecars(assets: Array<{ targetPath: string; content?: string; url?: string }>): Promise<Array<{ sourcePath: string; targetPath: string }>>;
      discoverCompanions(paths: string[]): Promise<CompanionScan>;
      preflightRenamePlan(items: Array<{ sourcePath: string; targetPath: string }>): Promise<RenamePlanIssue[]>;
      resolveRenameCollisions(groups: Array<{ items: Array<{ sourcePath: string; targetPath: string }> }>): Promise<Array<{ items: Array<{ sourcePath: string; targetPath: string }> }>>;
      executeRenamePlan(groups: Array<{ items: Array<{ sourcePath: string; targetPath: string }> }>, options?: { clearSourceJunk?: boolean; removeEmptySourceParents?: boolean; createExternalLog?: boolean; externalLogDirectory?: string }): Promise<RenameOperationRecord>;
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
      getMovie(movieId: string, mediaType?: 'movie' | 'tv'): Promise<MovieDetails>;
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
