import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { expandMediaPaths, isSystemMetadataPath, isVideoFile } from './mediaFiles.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('media path expansion', () => {
  it('recognizes supported video extensions case-insensitively', () => {
    expect(isVideoFile('/shows/episode.MKV')).toBe(true);
    expect(isVideoFile('/shows/episode.srt')).toBe(false);
  });

  it('rejects system metadata even when it has a video extension', () => {
    expect(isVideoFile('/shows/._Space King - S01E02.mp4')).toBe(false);
    expect(isSystemMetadataPath('/shows/.DS_Store')).toBe(true);
    expect(isSystemMetadataPath('/shows/__MACOSX/Space King.mp4')).toBe(true);
    expect(isSystemMetadataPath('/shows/Thumbs.db')).toBe(true);
    expect(isSystemMetadataPath('/shows/desktop.ini')).toBe(true);
  });

  it('recursively expands folders and ignores non-video files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'media-renamer-'));
    temporaryDirectories.push(root);
    await fs.mkdir(path.join(root, 'Season 2', 'Disc 1'), { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(root, 'Show.S01E01.mkv'), ''),
      fs.writeFile(path.join(root, '._Show.S01E01.mkv'), ''),
      fs.writeFile(path.join(root, '.DS_Store'), ''),
      fs.writeFile(path.join(root, 'notes.txt'), ''),
      fs.writeFile(path.join(root, 'Season 2', 'Disc 1', 'Show.S02E01.mp4'), ''),
    ]);
    await expect(expandMediaPaths([root])).resolves.toEqual([
      path.join(root, 'Season 2', 'Disc 1', 'Show.S02E01.mp4'),
      path.join(root, 'Show.S01E01.mkv'),
    ]);
  });
});
