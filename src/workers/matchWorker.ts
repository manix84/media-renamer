import { matchFiles } from '../core/matchBatch';
import type { Episode, FileMatch } from '../core/types';

type MatchRequest = {
  paths: string[];
  episodes: Episode[];
  titleMatching: boolean;
};

type MatchProgress = { type: 'progress'; completed: number; total: number };
type MatchComplete = { type: 'complete'; matches: FileMatch[] };

self.onmessage = (event: MessageEvent<MatchRequest>) => {
  const { paths, episodes, titleMatching } = event.data;
  const matches: FileMatch[] = matchFiles(paths, episodes, titleMatching, (completed, total) => {
    self.postMessage({ type: 'progress', completed, total } satisfies MatchProgress);
  });
  self.postMessage({ type: 'complete', matches } satisfies MatchComplete);
};
