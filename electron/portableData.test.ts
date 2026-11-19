import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { portableDataDirectory } from './portableData.js';

describe('portable application data', () => {
  it('uses an explicit portable data directory on every platform', () => {
    expect(portableDataDirectory({ MEDIA_RENAMER_PORTABLE_DATA: './portable-data' }, 'darwin')).toBe(path.resolve('portable-data'));
  });

  it('keeps Windows portable data beside the executable', () => {
    expect(portableDataDirectory({ PORTABLE_EXECUTABLE_DIR: 'D:\\Apps\\Media Renamer' }, 'win32'))
      .toBe(path.resolve('D:\\Apps\\Media Renamer', 'Media Renamer data'));
  });

  it('does not change installed application storage', () => {
    expect(portableDataDirectory({}, 'linux')).toBeUndefined();
  });
});
