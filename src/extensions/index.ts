import type { ExtensionPreferences } from '../core/types';
import { EXTENSION_API_VERSION, type ExtensionManifest, type ExtensionMatchClause, type ExtensionMediaContext, type InstalledExtension } from './types';

function matchesClause(context: ExtensionMediaContext, clause: ExtensionMatchClause): boolean {
  if (clause.genreIds?.length && !clause.genreIds.every((id) => context.genreIds?.includes(id))) return false;
  if (clause.originalLanguages?.length && !clause.originalLanguages.some((language) => language.toLowerCase() === context.originalLanguage?.toLowerCase())) return false;
  if (clause.originCountries?.length && !clause.originCountries.some((country) => context.originCountries?.some((candidate) => candidate.toUpperCase() === country.toUpperCase()))) return false;
  return Boolean(clause.genreIds?.length || clause.originalLanguages?.length || clause.originCountries?.length);
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
): Array<{ extensionId: string; label: string }> {
  if (!context) return [];
  return extensions.flatMap((extension) => preferences[extension.id]?.enabled && matchesExtension(extension, context)
    ? (extension.badges ?? []).map((badge) => ({ extensionId: extension.id, label: badge.label }))
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
      folderTemplate: preference.settings[tab.folderTemplateSettingKey]?.trim() || undefined,
      fileTemplate: preference.settings[tab.fileTemplateSettingKey]?.trim() || undefined,
    };
  }
  return undefined;
}

export type { ExtensionMediaContext, InstalledExtension } from './types';
