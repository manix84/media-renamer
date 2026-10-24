import { describe, expect, it } from 'vitest';
import { alternateLibraryRoots } from './libraryRoots';

const roots = [
  { id: 'shows:/TV', kind: 'shows' as const, name: 'TV', path: '/TV', updatedAt: 3 },
  { id: 'shows:/Archive', kind: 'shows' as const, name: 'Archive', path: '/Archive', updatedAt: 2 },
  { id: 'movies:/Movies', kind: 'movies' as const, name: 'Movies', path: '/Movies', updatedAt: 1 },
];

describe('alternate library roots', () => {
  it('does not offer the active destination as an alternative', () => {
    expect(alternateLibraryRoots(roots, 'shows', '/TV')).toEqual([roots[1]]);
  });

  it('does not expose roots belonging to the other media workflow', () => {
    expect(alternateLibraryRoots(roots, 'movies', '/Movies')).toEqual([]);
  });
});
