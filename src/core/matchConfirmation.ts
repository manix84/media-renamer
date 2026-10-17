import type { MovieFileMatch } from './movieMatching';
import type { FileMatch } from './types';

export type MatchConfirmationState = { kind: 'resolved' | 'suggestion' | 'blocked'; reason?: string };

export function tvMatchConfirmationState(item: FileMatch | undefined, confirmed: boolean): MatchConfirmationState {
  if (confirmed || item?.status === 'confident') return { kind: 'resolved' };
  if (item?.match) return { kind: 'suggestion' };
  return { kind: 'blocked', reason: item?.match?.reasons.join(' + ') || 'No episode suggestion is available.' };
}

export function movieMatchConfirmationState(match: MovieFileMatch | undefined, deferredToTv = false): MatchConfirmationState {
  if (deferredToTv) return { kind: 'blocked', reason: 'TV episode numbering was detected. Open this batch in TV mode.' };
  if (match?.status === 'confident') return { kind: 'resolved' };
  if (match?.status === 'review' && match.movie) return { kind: 'suggestion' };
  return {
    kind: 'blocked',
    reason: match?.error ?? (match?.status === 'detecting' ? 'Detection is still running.' : match?.reasons.join(' + ') || 'No movie suggestion is available.'),
  };
}
