import type { MediaClassificationMetadata } from '../core/types';

export const EXTENSION_API_VERSION = 1 as const;

export type ExtensionMediaKind = 'show' | 'movie';

export interface ExtensionMediaContext extends MediaClassificationMetadata {
  kind: ExtensionMediaKind;
  id: string;
  name: string;
  year?: number;
}

export interface ExtensionDirectorySetting {
  key: string;
  type: 'directory';
  label: string;
  description: string;
  pickerKind: 'TV' | 'Movie';
}

export interface ExtensionMatchClause {
  genreIds?: number[];
  originalLanguages?: string[];
  originCountries?: string[];
}

export interface ExtensionManifest {
  apiVersion: typeof EXTENSION_API_VERSION;
  id: string;
  name: string;
  version: string;
  description: string;
  settings: ExtensionDirectorySetting[];
  match: ExtensionMatchClause;
  anyOf?: ExtensionMatchClause[];
  badges?: Array<{ label: string }>;
  destinations?: Partial<Record<ExtensionMediaKind, { settingKey: string; label: string }>>;
  mediaSettingsTabs?: Array<{
    id: string;
    label: string;
    mediaKind: ExtensionMediaKind;
    note: string;
    baseFolderSettingKey: string;
    folderTemplateSettingKey: string;
    fileTemplateSettingKey: string;
  }>;
}

export interface InstalledExtension extends ExtensionManifest {
  source: 'installed' | 'preinstalled' | 'development';
  canUninstall: boolean;
}
