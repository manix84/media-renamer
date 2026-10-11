import { matchFile } from './matcher';
import type { Episode, FileMatch } from './types';

export function matchFiles(
  paths: string[],
  episodes: Episode[],
  titleMatching: boolean,
  onProgress: (completed: number, total: number) => void,
): FileMatch[] {
  return paths.map((path, index) => {
    const match = matchFile(path, episodes, titleMatching);
    onProgress(index + 1, paths.length);
    return match;
  });
}
