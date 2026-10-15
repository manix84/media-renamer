import { matchFile } from './matcher';
import type { Episode, FileMatch } from './types';

export function matchFiles(
  paths: string[],
  episodes: Episode[],
  titleMatching: boolean,
  onProgress: (completed: number, total: number) => void,
  confidenceThreshold = 0.8,
  showTitle?: string,
): FileMatch[] {
  return paths.map((path, index) => {
    const match = matchFile(path, episodes, titleMatching, confidenceThreshold, showTitle);
    onProgress(index + 1, paths.length);
    return match;
  });
}
