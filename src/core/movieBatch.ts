export type MovieBatchFilter = 'all' | 'ready' | 'review' | 'unmatched' | 'unchanged' | 'failed' | 'deferred';
export type MovieBatchState = { status?: 'detecting' | 'confident' | 'review' | 'unmatched' | 'error'; unchanged: boolean; deferred: boolean };

export function movieBatchFilterMatches(filter: MovieBatchFilter, item: MovieBatchState): boolean {
  if (filter === 'all') return true;
  if (filter === 'unchanged') return item.unchanged;
  if (filter === 'deferred') return item.deferred;
  if (item.deferred || item.unchanged) return false;
  if (filter === 'ready') return item.status === 'confident';
  if (filter === 'review') return item.status === 'review';
  if (filter === 'unmatched') return item.status === 'unmatched';
  return item.status === 'error';
}
