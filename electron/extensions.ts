import fs from 'node:fs';
import path from 'node:path';

const MANIFEST_NAME = 'media-renamer-extension.json';
const MAX_PACKAGE_FILES = 200;
const MAX_PACKAGE_BYTES = 10 * 1024 * 1024;

export type ExtensionSource = 'installed' | 'preinstalled' | 'development';
interface ExtensionMatchClause {
  mediaKinds?: Array<'show' | 'movie'>;
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
export interface InstalledExtensionManifest {
  apiVersion: 1;
  id: string;
  name: string;
  version: string;
  description: string;
  settings: Array<{ key: string; type: 'directory'; label: string; description: string; pickerKind: 'TV' | 'Movie' }>;
  match: ExtensionMatchClause;
  anyOf?: ExtensionMatchClause[];
  badges?: Array<{ label: string; tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }>;
  warnings?: Array<{ message: string; tone: 'info' | 'warning' | 'danger' }>;
  capabilities?: Array<{ id: 'network.metadata'; reason: string; origins: string[] }>;
  destinations?: Partial<Record<'show' | 'movie', { settingKey: string; label: string }>>;
  mediaSettingsTabs?: Array<{ id: string; label: string; mediaKind: 'show' | 'movie'; note: string; baseFolderSettingKey: string; folderTemplateSettingKey: string; fileTemplateSettingKey: string; defaultFolderTemplate?: string; defaultFileTemplate?: string }>;
  source: ExtensionSource;
  canUninstall: boolean;
}

function shortText(value: unknown, name: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`Extension ${name} is invalid.`);
  return value.trim();
}

function stringList(value: unknown, pattern: RegExp, maximum: number): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > maximum || value.some((entry) => typeof entry !== 'string' || !pattern.test(entry))) throw new Error('Extension matching rule is invalid.');
  return [...new Set(value as string[])];
}

function matchClause(value: unknown): InstalledExtensionManifest['match'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Extension match rule is required.');
  const source = value as Record<string, unknown>;
  const genreIds = source.genreIds === undefined ? undefined : Array.isArray(source.genreIds) && source.genreIds.length <= 50 && source.genreIds.every((id) => Number.isInteger(id) && Number(id) > 0) ? [...new Set(source.genreIds as number[])] : null;
  if (genreIds === null) throw new Error('Extension genre rule is invalid.');
  const result = {
    ...(stringList(source.mediaKinds, /^(show|movie)$/, 2)?.length ? { mediaKinds: stringList(source.mediaKinds, /^(show|movie)$/, 2) as Array<'show' | 'movie'> } : {}),
    ...(genreIds?.length ? { genreIds } : {}),
    ...(stringList(source.originalLanguages, /^[a-z]{2,3}$/i, 50)?.length ? { originalLanguages: stringList(source.originalLanguages, /^[a-z]{2,3}$/i, 50) } : {}),
    ...(stringList(source.originCountries, /^[a-z]{2}$/i, 50)?.length ? { originCountries: stringList(source.originCountries, /^[a-z]{2}$/i, 50) } : {}),
    ...(stringList(source.resolutions, /^[\w .+-]{1,40}$/, 50)?.length ? { resolutions: stringList(source.resolutions, /^[\w .+-]{1,40}$/, 50) } : {}),
    ...(stringList(source.sources, /^[\w .+-]{1,40}$/, 50)?.length ? { sources: stringList(source.sources, /^[\w .+-]{1,40}$/, 50) } : {}),
    ...(stringList(source.videoCodecs, /^[\w .+-]{1,40}$/, 50)?.length ? { videoCodecs: stringList(source.videoCodecs, /^[\w .+-]{1,40}$/, 50) } : {}),
    ...(stringList(source.audioCodecs, /^[\w .+-]{1,40}$/, 50)?.length ? { audioCodecs: stringList(source.audioCodecs, /^[\w .+-]{1,40}$/, 50) } : {}),
    ...(stringList(source.channels, /^[\w .+-]{1,40}$/, 50)?.length ? { channels: stringList(source.channels, /^[\w .+-]{1,40}$/, 50) } : {}),
    ...(stringList(source.audioLanguages, /^[\w .+-]{1,80}$/, 50)?.length ? { audioLanguages: stringList(source.audioLanguages, /^[\w .+-]{1,80}$/, 50) } : {}),
    ...(stringList(source.flags, /^[\w .+:'()-]{1,80}$/, 50)?.length ? { flags: stringList(source.flags, /^[\w .+:'()-]{1,80}$/, 50) } : {}),
    ...(stringList(source.releaseGroups, /^[\w .+-]{1,80}$/, 50)?.length ? { releaseGroups: stringList(source.releaseGroups, /^[\w .+-]{1,80}$/, 50) } : {}),
    ...(stringList(source.editions, /^[\w .+:'()-]{1,100}$/, 50)?.length ? { editions: stringList(source.editions, /^[\w .+:'()-]{1,100}$/, 50) } : {}),
  };
  if (!Object.keys(result).length) throw new Error('Extension match rule must contain at least one condition.');
  return result;
}

function networkOrigin(value: unknown): string {
  if (typeof value !== 'string' || value.length > 500) throw new Error('Extension network origin is invalid.');
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error('Extension network origin is invalid.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('Extension network origins must be exact HTTPS origins.');
  return parsed.origin;
}

export function normalizeExtensionManifest(value: unknown, source: ExtensionSource): InstalledExtensionManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Extension manifest is invalid.');
  const item = value as Record<string, unknown>;
  if (item.apiVersion !== 1) throw new Error('This extension uses an unsupported API version.');
  const id = shortText(item.id, 'ID', 200);
  if (!/^[a-z0-9][a-z0-9.-]*$/i.test(id)) throw new Error('Extension ID is invalid.');
  const settings = Array.isArray(item.settings) ? item.settings.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Extension setting is invalid.');
    const setting = entry as Record<string, unknown>;
    const key = shortText(setting.key, 'setting key', 200);
    if (!/^[a-z0-9][a-z0-9.-]*$/i.test(key) || setting.type !== 'directory' || (setting.pickerKind !== 'TV' && setting.pickerKind !== 'Movie')) throw new Error('Extension setting is invalid.');
    return { key, type: 'directory' as const, label: shortText(setting.label, 'setting label', 200), description: shortText(setting.description, 'setting description'), pickerKind: setting.pickerKind as 'TV' | 'Movie' };
  }) : [];
  if (settings.length > 50 || new Set(settings.map((setting) => setting.key)).size !== settings.length) throw new Error('Extension settings are invalid.');
  const settingKeys = new Set(settings.map((setting) => setting.key));
  const destinations = item.destinations && typeof item.destinations === 'object' && !Array.isArray(item.destinations)
    ? Object.fromEntries(Object.entries(item.destinations as Record<string, unknown>).flatMap(([kind, value]) => {
      if ((kind !== 'show' && kind !== 'movie') || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Extension destination is invalid.');
      const destination = value as Record<string, unknown>;
      const settingKey = shortText(destination.settingKey, 'destination setting key', 200);
      if (!settingKeys.has(settingKey)) throw new Error('Extension destination references an unknown setting.');
      return [[kind, { settingKey, label: shortText(destination.label, 'destination label', 200) }]];
    })) as InstalledExtensionManifest['destinations']
    : undefined;
  const badges = item.badges === undefined ? undefined : Array.isArray(item.badges) && item.badges.length <= 20
    ? item.badges.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Extension badge is invalid.');
      const badge = entry as Record<string, unknown>;
      if (badge.tone !== undefined && !['neutral', 'info', 'success', 'warning', 'danger'].includes(String(badge.tone))) throw new Error('Extension badge tone is invalid.');
      return { label: shortText(badge.label, 'badge label', 40), ...(badge.tone ? { tone: badge.tone as 'neutral' | 'info' | 'success' | 'warning' | 'danger' } : {}) };
    })
    : (() => { throw new Error('Extension badges are invalid.'); })();
  const warnings = item.warnings === undefined ? undefined : Array.isArray(item.warnings) && item.warnings.length <= 20
    ? item.warnings.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Extension warning is invalid.');
      const warning = entry as Record<string, unknown>;
      if (!['info', 'warning', 'danger'].includes(String(warning.tone))) throw new Error('Extension warning tone is invalid.');
      return { message: shortText(warning.message, 'warning message', 300), tone: warning.tone as 'info' | 'warning' | 'danger' };
    })
    : (() => { throw new Error('Extension warnings are invalid.'); })();
  const capabilities = item.capabilities === undefined ? undefined : Array.isArray(item.capabilities) && item.capabilities.length <= 20
    ? item.capabilities.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Extension capability is invalid.');
      const capability = entry as Record<string, unknown>;
      if (capability.id !== 'network.metadata' || !Array.isArray(capability.origins) || !capability.origins.length || capability.origins.length > 20) throw new Error('Extension capability is invalid.');
      return { id: 'network.metadata' as const, reason: shortText(capability.reason, 'capability reason', 300), origins: [...new Set(capability.origins.map(networkOrigin))] };
    })
    : (() => { throw new Error('Extension capabilities are invalid.'); })();
  if (capabilities && new Set(capabilities.map((capability) => capability.id)).size !== capabilities.length) throw new Error('Extension capability IDs must be unique.');
  const anyOf = item.anyOf === undefined ? undefined : Array.isArray(item.anyOf) && item.anyOf.length <= 20 ? item.anyOf.map(matchClause) : (() => { throw new Error('Extension alternative rules are invalid.'); })();
  const mediaSettingsTabs = item.mediaSettingsTabs === undefined ? undefined : Array.isArray(item.mediaSettingsTabs) && item.mediaSettingsTabs.length <= 10
    ? item.mediaSettingsTabs.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Extension media settings tab is invalid.');
      const tab = entry as Record<string, unknown>;
      const tabId = shortText(tab.id, 'media settings tab ID', 100);
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(tabId) || (tab.mediaKind !== 'show' && tab.mediaKind !== 'movie')) throw new Error('Extension media settings tab is invalid.');
      const baseFolderSettingKey = shortText(tab.baseFolderSettingKey, 'base folder setting key', 200);
      if (!settingKeys.has(baseFolderSettingKey)) throw new Error('Extension media settings tab references an unknown directory setting.');
      return {
        id: tabId,
        label: shortText(tab.label, 'media settings tab label', 100),
        mediaKind: tab.mediaKind as 'show' | 'movie',
        note: shortText(tab.note, 'media settings tab note'),
        baseFolderSettingKey,
        folderTemplateSettingKey: shortText(tab.folderTemplateSettingKey, 'folder template setting key', 200),
        fileTemplateSettingKey: shortText(tab.fileTemplateSettingKey, 'file template setting key', 200),
        ...(tab.defaultFolderTemplate === undefined ? {} : { defaultFolderTemplate: shortText(tab.defaultFolderTemplate, 'default folder template', 5000) }),
        ...(tab.defaultFileTemplate === undefined ? {} : { defaultFileTemplate: shortText(tab.defaultFileTemplate, 'default file template', 5000) }),
      };
    })
    : (() => { throw new Error('Extension media settings tabs are invalid.'); })();
  if (mediaSettingsTabs && new Set(mediaSettingsTabs.map((tab) => tab.id)).size !== mediaSettingsTabs.length) throw new Error('Extension media settings tab IDs must be unique.');
  return {
    apiVersion: 1,
    id,
    name: shortText(item.name, 'name', 200),
    version: shortText(item.version, 'version', 100),
    description: shortText(item.description, 'description'),
    settings,
    match: matchClause(item.match),
    ...(anyOf?.length ? { anyOf } : {}),
    ...(badges?.length ? { badges } : {}),
    ...(warnings?.length ? { warnings } : {}),
    ...(capabilities?.length ? { capabilities } : {}),
    ...(destinations && Object.keys(destinations).length ? { destinations } : {}),
    ...(mediaSettingsTabs?.length ? { mediaSettingsTabs } : {}),
    source,
    canUninstall: source === 'installed',
  };
}

async function readManifest(directory: string, source: ExtensionSource): Promise<InstalledExtensionManifest> {
  const raw = await fs.promises.readFile(path.join(directory, MANIFEST_NAME), 'utf8');
  if (raw.length > 256 * 1024) throw new Error('Extension manifest is too large.');
  return normalizeExtensionManifest(JSON.parse(raw), source);
}

export function inspectExtensionPackage(directory: string): Promise<InstalledExtensionManifest> {
  return readManifest(directory, 'installed');
}

async function packageDirectories(root: string): Promise<string[]> {
  try {
    if ((await fs.promises.stat(path.join(root, MANIFEST_NAME))).isFile()) return [root];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  try {
    const entries = await fs.promises.readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && !entry.isSymbolicLink()).map((entry) => path.join(root, entry.name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function discoverExtensions(sources: Array<{ directory: string; source: ExtensionSource }>): Promise<InstalledExtensionManifest[]> {
  const extensions = new Map<string, InstalledExtensionManifest>();
  for (const { directory, source } of sources) {
    for (const packageDirectory of await packageDirectories(directory)) {
      try {
        const manifest = await readManifest(packageDirectory, source);
        extensions.set(manifest.id, manifest);
      } catch {
        // Invalid packages are ignored during discovery and remain visible on disk for repair.
      }
    }
  }
  return [...extensions.values()].sort((left, right) => left.name.localeCompare(right.name));
}

async function validatePackageTree(directory: string): Promise<void> {
  let files = 0;
  let bytes = 0;
  const visit = async (current: string): Promise<void> => {
    for (const entry of await fs.promises.readdir(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Extension packages cannot contain symbolic links.');
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile()) {
        files += 1;
        bytes += (await fs.promises.stat(entryPath)).size;
        if (files > MAX_PACKAGE_FILES || bytes > MAX_PACKAGE_BYTES) throw new Error('Extension package is too large.');
      }
    }
  };
  await visit(directory);
}

export async function installExtension(sourceDirectory: string, installedRoot: string): Promise<InstalledExtensionManifest> {
  if (!path.isAbsolute(sourceDirectory)) throw new Error('Invalid extension directory.');
  const manifest = await readManifest(sourceDirectory, 'installed');
  await validatePackageTree(sourceDirectory);
  await fs.promises.mkdir(installedRoot, { recursive: true });
  const destination = path.join(installedRoot, manifest.id);
  const temporary = path.join(installedRoot, `.${manifest.id}-${Date.now()}.installing`);
  await fs.promises.cp(sourceDirectory, temporary, { recursive: true, errorOnExist: true });
  await fs.promises.rm(destination, { recursive: true, force: true });
  await fs.promises.rename(temporary, destination);
  return manifest;
}

export async function uninstallExtension(id: string, installedRoot: string): Promise<void> {
  if (!/^[a-z0-9][a-z0-9.-]{0,199}$/i.test(id)) throw new Error('Invalid extension ID.');
  await fs.promises.rm(path.join(installedRoot, id), { recursive: true, force: true });
}
