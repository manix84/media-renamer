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
  await Promise.all(names.map((name) => fs.writeFile(path.join(directory, name), 'content')));
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

  it('discovers nested movie subtitles and normalizes Plex language and role suffixes', async () => {
    const directory = await fixture(['Movie.2020.mkv']);
    const subs = path.join(directory, 'Subs');
    const alternate = path.join(directory, 'Subtitles', 'Alternate');
    await Promise.all([fs.mkdir(subs, { recursive: true }), fs.mkdir(alternate, { recursive: true })]);
    await Promise.all([
      fs.writeFile(path.join(subs, 'English [SDH].srt'), 'subtitle'),
      fs.writeFile(path.join(subs, 'English.srt'), 'subtitle'),
      fs.writeFile(path.join(subs, 'eng.srt'), 'subtitle'),
      fs.writeFile(path.join(subs, 'Commentary.srt'), 'subtitle'),
      fs.writeFile(path.join(subs, 'Dubtitles.srt'), 'subtitle'),
      fs.writeFile(path.join(subs, 'Empty.srt'), ''),
      fs.writeFile(path.join(alternate, 'French.forced.ass'), 'subtitle'),
    ]);
    const videoPath = path.join(directory, 'Movie.2020.mkv');
    const scan = await discoverMediaCompanions([videoPath]);

    expect(scan.byVideo[videoPath].map((companion) => companion.suffix)).toEqual(['.srt', '.2.srt', '.en.srt', '.en.sdh.srt', '.en.2.srt', '.fr.forced.ass']);
    expect(scan.byVideo[videoPath].some((companion) => companion.path.endsWith('Empty.srt'))).toBe(false);
    expect(scan.ambiguous).toEqual([]);
  });

  it('associates generic root subtitles and artwork only when there is one video', async () => {
    const directory = await fixture(['Movie.2020.mkv', 'English.srt', 'Turkish.srt', 'Poster.jpg', 'AhaShare.com.txt']);
    const videoPath = path.join(directory, 'Movie.2020.mkv');
    const scan = await discoverMediaCompanions([videoPath]);
    expect(scan.byVideo[videoPath].map(({ suffix, kind }) => ({ suffix, kind }))).toEqual([
      { suffix: '.en.srt', kind: 'subtitle' },
      { suffix: '-poster.jpg', kind: 'artwork' },
      { suffix: '.tr.srt', kind: 'subtitle' },
    ]);
  });

  it('does not guess which video owns generic root companions', async () => {
    const directory = await fixture(['First.mkv', 'Second.mkv', 'English.srt', 'Poster.jpg']);
    const videos = [path.join(directory, 'First.mkv'), path.join(directory, 'Second.mkv')];
    const scan = await discoverMediaCompanions(videos);
    expect(scan.byVideo[videos[0]]).toEqual([]);
    expect(scan.byVideo[videos[1]]).toEqual([]);
  });

  it('keeps nested subtitles ambiguous when a shared folder contains multiple movies', async () => {
    const directory = await fixture(['First.Movie.2020.mkv', 'Second.Movie.2021.mkv']);
    const subs = path.join(directory, 'Subs');
    await fs.mkdir(subs);
    await fs.writeFile(path.join(subs, 'English.srt'), 'subtitle');
    const videos = [path.join(directory, 'First.Movie.2020.mkv'), path.join(directory, 'Second.Movie.2021.mkv')];
    const scan = await discoverMediaCompanions(videos);
    expect(scan.ambiguous).toEqual([{ path: path.join(subs, 'English.srt'), candidateVideoPaths: videos }]);
  });
});
