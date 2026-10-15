import fs from 'node:fs';
import path from 'node:path';

export type PersistedPreferences = {
  autoClearCompletedBatch?: boolean;
  createExternalRenameLog?: boolean;
  episodeTemplate?: string;
  fileViewMode?: 'detailed' | 'summary' | 'compact';
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
};

const stringKeys = new Set(['episodeTemplate', 'movieBaseFolder', 'movieFolderTemplate', 'movieTemplate', 'renameLogFolder', 'showFolderTemplate', 'tvBaseFolder']);

export function normalizePreferences(value: unknown): PersistedPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const result: PersistedPreferences = {};
  for (const key of stringKeys) {
    const entry = source[key];
    if (typeof entry === 'string' && entry.length <= 32_768) (result as Record<string, unknown>)[key] = entry;
  }
  if (source.fileViewMode === 'detailed' || source.fileViewMode === 'summary' || source.fileViewMode === 'compact') result.fileViewMode = source.fileViewMode;
  if (typeof source.matchConfidenceThreshold === 'number' && Number.isFinite(source.matchConfidenceThreshold) && source.matchConfidenceThreshold >= 50 && source.matchConfidenceThreshold <= 100) result.matchConfidenceThreshold = Math.round(source.matchConfidenceThreshold);
  if (typeof source.removeEmptySourceParents === 'boolean') result.removeEmptySourceParents = source.removeEmptySourceParents;
  if (typeof source.autoClearCompletedBatch === 'boolean') result.autoClearCompletedBatch = source.autoClearCompletedBatch;
  if (typeof source.createExternalRenameLog === 'boolean') result.createExternalRenameLog = source.createExternalRenameLog;
  if (source.themePreference === 'system' || source.themePreference === 'light' || source.themePreference === 'dark') result.themePreference = source.themePreference;
  if (source.themePalette === 'classic' || source.themePalette === 'ocean' || source.themePalette === 'forest' || source.themePalette === 'rose' || source.themePalette === 'amber' || source.themePalette === 'halloween' || source.themePalette === 'christmas') result.themePalette = source.themePalette;
  if (typeof source.titleMatching === 'boolean') result.titleMatching = source.titleMatching;
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
