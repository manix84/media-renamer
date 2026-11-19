import path from 'node:path';

export function portableDataDirectory(environment: NodeJS.ProcessEnv, platform: NodeJS.Platform): string | undefined {
  const explicit = environment.MEDIA_RENAMER_PORTABLE_DATA?.trim();
  if (explicit) return path.resolve(explicit);
  const executableDirectory = environment.PORTABLE_EXECUTABLE_DIR?.trim();
  if (platform === 'win32' && executableDirectory) return path.resolve(executableDirectory, 'Media Renamer data');
  return undefined;
}
