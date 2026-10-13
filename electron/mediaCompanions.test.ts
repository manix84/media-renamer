import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverMediaCompanions } from './mediaCompanions';

const temporaryDirectories: string[] = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));

async function fixture(names: string[]) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'media-renamer-companions-'));
  temporaryDirectories.push(directory);
  await Promise.all(names.map((name) => fs.writeFile(path.join(directory, name), '')));
  return directory;
}

describe('media companion discovery', () => {
  it('groups language subtitles, metadata and named artwork with a video', async () => {
    const directory = await fixture(['Show.S01E01.mkv', 'Show.S01E01.en.forced.srt', 'Show.S01E01.nfo', 'Show.S01E01-thumb.jpg', 'Show.S01E01.random.jpg', 'Show.S01E010.srt', 'notes.txt']);
    const videoPath = path.join(directory, 'Show.S01E01.mkv');
    const scan = await discoverMediaCompanions([videoPath]);
    expect(scan.byVideo[videoPath].map(({ suffix, kind }) => ({ suffix, kind }))).toEqual([
      { suffix: '-thumb.jpg', kind: 'artwork' },
      { suffix: '.en.forced.srt', kind: 'subtitle' },
      { suffix: '.nfo', kind: 'metadata' },
    ]);
    expect(scan.ambiguous).toEqual([]);
  });

  it('surfaces a sidecar that can belong to more than one imported video', async () => {
    const directory = await fixture(['Episode.mkv', 'Episode.en.mkv', 'Episode.en.srt']);
    const videos = [path.join(directory, 'Episode.mkv'), path.join(directory, 'Episode.en.mkv')];
    const scan = await discoverMediaCompanions(videos);
    expect(scan.ambiguous).toEqual([{ path: path.join(directory, 'Episode.en.srt'), candidateVideoPaths: videos }]);
  });
});
