import fs from 'node:fs';
import path from 'node:path';

export type SavedMatchDecision = { showId: string; filenameKey: string; episodeIds: string[]; updatedAt: number };
export type ShowRule = { showId: string; titleMatching: boolean; confidenceThreshold: number; updatedAt: number };
export type SavedLibraryRoot = { id: string; kind: 'shows' | 'movies'; name: string; path: string; updatedAt: number };
export type SavedBatchQueue = { id: string; name: string; mediaType: 'shows' | 'movies'; paths: string[]; updatedAt: number };

export type PersistedPreferences = {
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
};

const stringKeys = new Set(['episodeTemplate', 'movieBaseFolder', 'movieFolderTemplate', 'movieTemplate', 'releaseAliasText', 'renameLogFolder', 'showFolderTemplate', 'tvBaseFolder']);

export function normalizePreferences(value: unknown): PersistedPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const result: PersistedPreferences = {};
  for (const key of stringKeys) {
    const entry = source[key];
    if (typeof entry === 'string' && entry.length <= 32_768) (result as Record<string, unknown>)[key] = entry;
  }
  if (source.fileViewMode === 'detailed' || source.fileViewMode === 'summary' || source.fileViewMode === 'compact') result.fileViewMode = source.fileViewMode;
  if (source.languagePreference === 'system' || source.languagePreference === 'en' || source.languagePreference === 'es' || source.languagePreference === 'fr' || source.languagePreference === 'de' || source.languagePreference === 'it' || source.languagePreference === 'pt-BR' || source.languagePreference === 'ja' || source.languagePreference === 'ko' || source.languagePreference === 'zh-CN') result.languagePreference = source.languagePreference;
  if (typeof source.matchConfidenceThreshold === 'number' && Number.isFinite(source.matchConfidenceThreshold) && source.matchConfidenceThreshold >= 50 && source.matchConfidenceThreshold <= 100) result.matchConfidenceThreshold = Math.round(source.matchConfidenceThreshold);
  if (typeof source.removeEmptySourceParents === 'boolean') result.removeEmptySourceParents = source.removeEmptySourceParents;
  if (typeof source.autoClearCompletedBatch === 'boolean') result.autoClearCompletedBatch = source.autoClearCompletedBatch;
  if (typeof source.completionChime === 'boolean') result.completionChime = source.completionChime;
  if (typeof source.completionReport === 'boolean') result.completionReport = source.completionReport;
  if (typeof source.completionReportAutoClose === 'boolean') result.completionReportAutoClose = source.completionReportAutoClose;
  if (typeof source.clearSourceJunk === 'boolean') result.clearSourceJunk = source.clearSourceJunk;
  if (typeof source.createExternalRenameLog === 'boolean') result.createExternalRenameLog = source.createExternalRenameLog;
  if (typeof source.developerMode === 'boolean') result.developerMode = source.developerMode;
  if (typeof source.exportNfo === 'boolean') result.exportNfo = source.exportNfo;
  if (typeof source.exportPlexArtwork === 'boolean') result.exportPlexArtwork = source.exportPlexArtwork;
  if (source.themePreference === 'system' || source.themePreference === 'light' || source.themePreference === 'dark') result.themePreference = source.themePreference;
  if (source.themePalette === 'classic' || source.themePalette === 'ocean' || source.themePalette === 'forest' || source.themePalette === 'rose' || source.themePalette === 'amber' || source.themePalette === 'valentines' || source.themePalette === 'pride' || source.themePalette === 'bonfire' || source.themePalette === 'new-year' || source.themePalette === 'spring' || source.themePalette === 'summer' || source.themePalette === 'autumn' || source.themePalette === 'winter' || source.themePalette === 'halloween' || source.themePalette === 'christmas') result.themePalette = source.themePalette;
  if (typeof source.titleMatching === 'boolean') result.titleMatching = source.titleMatching;
  if (Array.isArray(source.savedMatchDecisions)) {
    result.savedMatchDecisions = source.savedMatchDecisions.flatMap((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const item = value as Record<string, unknown>;
      if (typeof item.showId !== 'string' || !item.showId || item.showId.length > 200
        || typeof item.filenameKey !== 'string' || !item.filenameKey || item.filenameKey.length > 1000
        || !Array.isArray(item.episodeIds) || !item.episodeIds.length || item.episodeIds.length > 20
        || !item.episodeIds.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 200)
        || typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt)) return [];
      return [{ showId: item.showId, filenameKey: item.filenameKey, episodeIds: item.episodeIds as string[], updatedAt: item.updatedAt }];
    }).slice(0, 1000);
  }
  if (Array.isArray(source.savedLibraryRoots)) {
    result.savedLibraryRoots = source.savedLibraryRoots.flatMap((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const item = value as Record<string, unknown>;
      if (typeof item.id !== 'string' || !item.id || item.id.length > 200
        || (item.kind !== 'shows' && item.kind !== 'movies')
        || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200
        || typeof item.path !== 'string' || !item.path || item.path.length > 4096
        || typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt)) return [];
      return [{ id: item.id, kind: item.kind as SavedLibraryRoot['kind'], name: item.name.trim(), path: item.path, updatedAt: item.updatedAt }];
    }).slice(0, 100);
  }
  if (Array.isArray(source.savedBatchQueues)) {
    result.savedBatchQueues = source.savedBatchQueues.flatMap((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const item = value as Record<string, unknown>;
      if (typeof item.id !== 'string' || !item.id || item.id.length > 200
        || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200
        || (item.mediaType !== 'shows' && item.mediaType !== 'movies')
        || !Array.isArray(item.paths) || !item.paths.length || item.paths.length > 5000
        || !item.paths.every((entry) => typeof entry === 'string' && entry.length > 0 && entry.length <= 4096)
        || typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt)) return [];
      return [{ id: item.id, name: item.name.trim(), mediaType: item.mediaType as SavedBatchQueue['mediaType'], paths: [...new Set(item.paths as string[])], updatedAt: item.updatedAt }];
    }).slice(0, 100);
  }
  if (Array.isArray(source.showRules)) {
    result.showRules = source.showRules.flatMap((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const item = value as Record<string, unknown>;
      if (typeof item.showId !== 'string' || !item.showId || item.showId.length > 200
        || typeof item.titleMatching !== 'boolean'
        || typeof item.confidenceThreshold !== 'number' || !Number.isFinite(item.confidenceThreshold) || item.confidenceThreshold < 50 || item.confidenceThreshold > 100
        || typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt)) return [];
      return [{ showId: item.showId, titleMatching: item.titleMatching, confidenceThreshold: Math.round(item.confidenceThreshold), updatedAt: item.updatedAt }];
    }).slice(0, 500);
  }
  return result;
}

export async function readPreferences(filePath: string): Promise<PersistedPreferences> {
  try {
    return normalizePreferences(JSON.parse(await fs.promises.readFile(filePath, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) return {};
    throw error;
  }
}

export async function writePreferences(filePath: string, preferences: PersistedPreferences): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await fs.promises.writeFile(temporaryPath, `${JSON.stringify(normalizePreferences(preferences), null, 2)}\n`, 'utf8');
  await fs.promises.rename(temporaryPath, filePath);
}
