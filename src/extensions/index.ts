import type { ExtensionPreferences } from '../core/types';
import { EXTENSION_API_VERSION, type ExtensionManifest, type ExtensionMatchClause, type ExtensionMediaContext, type InstalledExtension } from './types';

function matchesClause(context: ExtensionMediaContext, clause: ExtensionMatchClause): boolean {
  const contains = (values: string[] | undefined, candidate: string | undefined) => !values?.length || Boolean(candidate && values.some((value) => value.toLowerCase() === candidate.toLowerCase()));
  const overlaps = (values: string[] | undefined, candidates: string[] | undefined) => !values?.length || Boolean(candidates?.some((candidate) => values.some((value) => value.toLowerCase() === candidate.toLowerCase())));
  if (clause.mediaKinds?.length && !clause.mediaKinds.includes(context.kind)) return false;
  if (clause.genreIds?.length && !clause.genreIds.every((id) => context.genreIds?.includes(id))) return false;
  if (!contains(clause.originalLanguages, context.originalLanguage)) return false;
  if (clause.originCountries?.length && !clause.originCountries.some((country) => context.originCountries?.some((candidate) => candidate.toUpperCase() === country.toUpperCase()))) return false;
  if (!contains(clause.resolutions, context.resolution)) return false;
  if (!contains(clause.sources, context.source)) return false;
  if (!contains(clause.videoCodecs, context.videoCodec)) return false;
  if (!contains(clause.audioCodecs, context.audioCodec)) return false;
  if (!contains(clause.channels, context.channels)) return false;
  if (!overlaps(clause.audioLanguages, context.audioLanguages)) return false;
  if (!overlaps(clause.flags, context.flags)) return false;
  if (!contains(clause.releaseGroups, context.releaseGroup)) return false;
  if (!contains(clause.editions, context.edition)) return false;
  return Object.values(clause).some((value) => Array.isArray(value) && value.length > 0);
}

function matchesExtension(extension: ExtensionManifest, context: ExtensionMediaContext): boolean {
  return extension.apiVersion === EXTENSION_API_VERSION
    && matchesClause(context, extension.match)
    && (!extension.anyOf?.length || extension.anyOf.some((clause) => matchesClause(context, clause)));
}

export function resolveExtensionBadges(
  context: ExtensionMediaContext | undefined,
  preferences: ExtensionPreferences,
  extensions: readonly InstalledExtension[],
): Array<{ extensionId: string; label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> {
  if (!context) return [];
  return extensions.flatMap((extension) => preferences[extension.id]?.enabled && matchesExtension(extension, context)
    ? (extension.badges ?? []).map((badge) => ({ extensionId: extension.id, label: badge.label, tone: badge.tone ?? 'info' }))
    : []);
}

export function resolveExtensionWarnings(
  context: ExtensionMediaContext | undefined,
  preferences: ExtensionPreferences,
  extensions: readonly InstalledExtension[],
): Array<{ extensionId: string; message: string; tone: 'info' | 'warning' | 'danger' }> {
  if (!context) return [];
  return extensions.flatMap((extension) => preferences[extension.id]?.enabled && matchesExtension(extension, context)
    ? (extension.warnings ?? []).map((warning) => ({ extensionId: extension.id, message: warning.message, tone: warning.tone }))
    : []);
}

export function resolveExtensionDestination(
  context: ExtensionMediaContext | undefined,
  preferences: ExtensionPreferences,
  extensions: readonly InstalledExtension[],
): { baseFolder: string; extensionId: string; label: string } | undefined {
  if (!context) return undefined;
  for (const extension of extensions) {
    const preference = preferences[extension.id];
    if (!preference?.enabled || !matchesExtension(extension, context)) continue;
    const destination = extension.destinations?.[context.kind];
    const baseFolder = destination && preference.settings[destination.settingKey]?.trim();
    if (baseFolder && destination) return { baseFolder, extensionId: extension.id, label: destination.label };
  }
  return undefined;
}

export function resolveExtensionMediaSettings(
  context: ExtensionMediaContext | undefined,
  preferences: ExtensionPreferences,
  extensions: readonly InstalledExtension[],
): { extensionId: string; tabId: string; mediaKind: 'show' | 'movie'; baseFolder?: string; folderTemplate?: string; fileTemplate?: string } | undefined {
  if (!context) return undefined;
  for (const extension of extensions) {
    const preference = preferences[extension.id];
    if (!preference?.enabled || !matchesExtension(extension, context)) continue;
    const tab = extension.mediaSettingsTabs?.find((candidate) => candidate.mediaKind === context.kind);
    if (!tab) continue;
    return {
      extensionId: extension.id,
      tabId: tab.id,
      mediaKind: tab.mediaKind,
      baseFolder: preference.settings[tab.baseFolderSettingKey]?.trim() || undefined,
      folderTemplate: preference.settings[tab.folderTemplateSettingKey]?.trim() || tab.defaultFolderTemplate,
      fileTemplate: preference.settings[tab.fileTemplateSettingKey]?.trim() || tab.defaultFileTemplate,
    };
  }
  return undefined;
}

export type { ExtensionMediaContext, InstalledExtension } from './types';
