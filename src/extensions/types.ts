import type { MediaClassificationMetadata } from '../core/types';

export const EXTENSION_API_VERSION = 1 as const;

export type ExtensionMediaKind = 'show' | 'movie';

export interface ExtensionMediaContext extends MediaClassificationMetadata {
  kind: ExtensionMediaKind;
  id: string;
  name: string;
  year?: number;
  resolution?: string;
  source?: string;
  videoCodec?: string;
  audioCodec?: string;
  channels?: string;
  audioLanguages?: string[];
  flags?: string[];
  releaseGroup?: string;
  edition?: string;
}

export interface ExtensionDirectorySetting {
  key: string;
  type: 'directory';
  label: string;
  description: string;
  pickerKind: 'TV' | 'Movie';
}

export interface ExtensionMatchClause {
  mediaKinds?: ExtensionMediaKind[];
  genreIds?: number[];
  originalLanguages?: string[];
  originCountries?: string[];
  resolutions?: string[];
  sources?: string[];
  videoCodecs?: string[];
  audioCodecs?: string[];
  channels?: string[];
  audioLanguages?: string[];
  flags?: string[];
  releaseGroups?: string[];
  editions?: string[];
}

export type ExtensionContributionTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface ExtensionCapability {
  id: 'network.metadata';
  reason: string;
  origins: string[];
}

export interface ExtensionMetadataAdapter {
  id: string;
  label: string;
  capability: 'network.metadata';
  transport: 'graphql-json';
  origin: string;
  endpointPath: string;
  operations: Array<{
    id: string;
    label: string;
    kind: 'search' | 'details' | 'cross-reference';
    mediaKinds: ExtensionMediaKind[];
    query: string;
    inputs: Array<{ name: string; type: 'string'; required: boolean; maximumLength: number }>;
  }>;
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
  badges?: Array<{ label: string; tone?: ExtensionContributionTone }>;
  warnings?: Array<{ message: string; tone: 'info' | 'warning' | 'danger' }>;
  capabilities?: ExtensionCapability[];
  metadataAdapters?: ExtensionMetadataAdapter[];
  destinations?: Partial<Record<ExtensionMediaKind, { settingKey: string; label: string }>>;
  mediaSettingsTabs?: Array<{
    id: string;
    label: string;
    mediaKind: ExtensionMediaKind;
    note: string;
    baseFolderSettingKey: string;
    folderTemplateSettingKey: string;
    fileTemplateSettingKey: string;
    defaultFolderTemplate?: string;
    defaultFileTemplate?: string;
  }>;
}

export interface InstalledExtension extends ExtensionManifest {
  source: 'installed' | 'preinstalled' | 'development';
  canUninstall: boolean;
}
