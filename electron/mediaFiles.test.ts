import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { expandMediaPaths, isImportableVideoFile, isReleaseJunkVideoPath, isSystemMetadataPath, isVideoFile } from './mediaFiles.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('media path expansion', () => {
  it('recognizes supported video extensions case-insensitively', () => {
    expect(isVideoFile('/shows/episode.MKV')).toBe(true);
    expect(isVideoFile('/shows/episode.MPG')).toBe(true);
    expect(isVideoFile('/shows/episode.mpeg')).toBe(true);
    expect(isVideoFile('/shows/episode.srt')).toBe(false);
  });

  it('rejects system metadata even when it has a video extension', () => {
    expect(isVideoFile('/shows/._Space King - S01E02.mp4')).toBe(false);
    expect(isSystemMetadataPath('/shows/.DS_Store')).toBe(true);
    expect(isSystemMetadataPath('/shows/__MACOSX/Space King.mp4')).toBe(true);
    expect(isSystemMetadataPath('/shows/Thumbs.db')).toBe(true);
    expect(isSystemMetadataPath('/shows/desktop.ini')).toBe(true);
  });

  it('rejects the Kingdom-RG promotional video only inside a Kingdom-RG release', () => {
    const junk = '/incoming/Masters Of The Universe 2026 1080p Blu-Ray Subs KINGDOM-RG/KINGDOM RG.mkv';
    expect(isVideoFile(junk)).toBe(true);
    expect(isReleaseJunkVideoPath(junk)).toBe(true);
    expect(isImportableVideoFile(junk)).toBe(false);
    expect(isImportableVideoFile('/incoming/Kingdom RG.mkv')).toBe(true);
    expect(isImportableVideoFile('/incoming/KINGDOM-RG/Actual Movie.mkv')).toBe(true);
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
      fs.writeFile(path.join(root, 'Movie.mpg'), ''),
      fs.writeFile(path.join(root, 'Season 2', 'Disc 1', 'Show.S02E01.mp4'), ''),
    ]);
    await expect(expandMediaPaths([root])).resolves.toEqual([
      path.join(root, 'Movie.mpg'),
      path.join(root, 'Season 2', 'Disc 1', 'Show.S02E01.mp4'),
      path.join(root, 'Show.S01E01.mkv'),
    ]);
  });

  it('does not import a Kingdom-RG promotional MKV beside the real feature', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'media-renamer-kingdom-rg-'));
    temporaryDirectories.push(root);
    const release = path.join(root, 'Movie 2026 1080p BluRay KINGDOM-RG');
    await fs.mkdir(release);
    await Promise.all([
      fs.writeFile(path.join(release, 'Movie 2026 1080p BluRay.mkv'), 'feature'),
      fs.writeFile(path.join(release, 'KINGDOM RG.mkv'), 'advert'),
    ]);
    await expect(expandMediaPaths([release])).resolves.toEqual([path.join(release, 'Movie 2026 1080p BluRay.mkv')]);
  });
});
