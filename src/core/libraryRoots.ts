import type { SavedLibraryRoot } from './types';

export function alternateLibraryRoots(
  roots: SavedLibraryRoot[],
  kind: SavedLibraryRoot['kind'],
  activePath: string,
): SavedLibraryRoot[] {
  return roots.filter((root) => root.kind === kind && root.path !== activePath);
}
