import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { tmdbHelperPath } from './tmdbNative';

describe('native TMDB helper', () => {
  it('uses the packaged platform-specific helper path', () => {
    expect(tmdbHelperPath('/resources', 'linux')).toBe(path.join('/resources', 'bin', 'tmdb-helper'));
    expect(tmdbHelperPath('/resources', 'win32')).toBe(path.join('/resources', 'bin', 'tmdb-helper.exe'));
  });
});
