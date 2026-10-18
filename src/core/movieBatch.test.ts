import { describe, expect, it } from 'vitest';
import { movieBatchFilterMatches, type MovieBatchFilter, type MovieBatchState } from './movieBatch';

describe('movie batch filters', () => {
  const cases: Array<[MovieBatchFilter, MovieBatchState]> = [
    ['ready', { status: 'confident', unchanged: false, deferred: false }],
    ['review', { status: 'review', unchanged: false, deferred: false }],
    ['unmatched', { status: 'unmatched', unchanged: false, deferred: false }],
    ['failed', { status: 'error', unchanged: false, deferred: false }],
    ['unchanged', { status: 'confident', unchanged: true, deferred: false }],
    ['deferred', { unchanged: false, deferred: true }],
  ];

  it.each(cases)('shows only the intended %s items', (filter, item) => {
    expect(movieBatchFilterMatches(filter, item)).toBe(true);
    for (const other of cases.map(([name]) => name).filter((name) => name !== filter)) {
      expect(movieBatchFilterMatches(other, item)).toBe(false);
    }
    expect(movieBatchFilterMatches('all', item)).toBe(true);
  });
});
