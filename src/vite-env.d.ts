/// <reference types="vite/client" />

import type { Episode, MediaTechnicalTags, ProviderStatus, RenamePlanIssue, ShowDetails, ShowSearchResult } from './core/types';
import type { DebugEntry, DebugLevel } from './DebugConsole';

declare global {
  interface Window {
    mediaRenamer?: {
      platform: string;
      pickFiles(): Promise<string[]>;
      pickFolders(): Promise<string[]>;
      pickDestinationFolder(): Promise<string | undefined>;
      expandPaths(paths: string[]): Promise<string[]>;
      pathForFile(file: File): string;
      probeMedia(filePath: string): Promise<MediaTechnicalTags>;
      preflightRenamePlan(items: Array<{ sourcePath: string; targetPath: string }>): Promise<RenamePlanIssue[]>;
      exportRenamePlan(plan: unknown): Promise<string | undefined>;
      providerStatus(): Promise<ProviderStatus>;
      searchShows(query: string): Promise<ShowSearchResult[]>;
      getShow(showId: string): Promise<ShowDetails>;
      getSeasonEpisodes(showId: string, season: number): Promise<Episode[]>;
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
