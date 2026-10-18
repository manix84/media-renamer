import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { executeRenamePlan, readLatestRenameOperation, resolveRenameCollisions, undoRenameOperation } from './renameExecution';

const temporaryDirectories: string[] = [];
async function temporaryDirectory() {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-renamer-execution-'));
  temporaryDirectories.push(directory);
  return directory;
}
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => fs.promises.rm(directory, { recursive: true, force: true }))));

describe('rename execution', () => {
  it('moves files, writes an operation log, and undoes the operation', async () => {
    const root = await temporaryDirectory();
    const source = path.join(root, 'incoming', 'Old.mkv');
    const target = path.join(root, 'library', 'Show', 'New.mkv');
    await fs.promises.mkdir(path.dirname(source), { recursive: true });
    await fs.promises.writeFile(source, 'video');
    const executed = await executeRenamePlan([{ sourcePath: source, targetPath: target }], path.join(root, 'history'));
    await expect(fs.promises.readFile(target, 'utf8')).resolves.toBe('video');
    await expect(fs.promises.stat(source)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.promises.stat(executed.logPath)).resolves.toBeDefined();
    const undone = await undoRenameOperation(executed.operation, executed.logPath);
    expect(undone.status).toBe('undone');
    await expect(fs.promises.readFile(source, 'utf8')).resolves.toBe('video');
    await expect(fs.promises.stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('returns restored files to their renamed paths when the undo log cannot be updated', async () => {
    const root = await temporaryDirectory();
    const source = path.join(root, 'Old.mkv');
    const target = path.join(root, 'New.mkv');
    await fs.promises.writeFile(source, 'video');
    const executed = await executeRenamePlan([{ sourcePath: source, targetPath: target }], path.join(root, 'history'));
    const occupiedParent = path.join(root, 'occupied');
    await fs.promises.writeFile(occupiedParent, 'not a directory');

    await expect(undoRenameOperation(executed.operation, path.join(occupiedParent, 'operation.json'))).rejects.toThrow(/log could not be updated/i);
    await expect(fs.promises.readFile(target, 'utf8')).resolves.toBe('video');
    await expect(fs.promises.stat(source)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('stops after the current file and leaves the completed subset undoable', async () => {
    const root = await temporaryDirectory();
    const firstSource = path.join(root, 'incoming', 'One.mkv');
    const secondSource = path.join(root, 'incoming', 'Two.mkv');
    const firstTarget = path.join(root, 'library', 'One.mkv');
    const secondTarget = path.join(root, 'library', 'Two.mkv');
    await fs.promises.mkdir(path.dirname(firstSource), { recursive: true });
    await Promise.all([fs.promises.writeFile(firstSource, 'one'), fs.promises.writeFile(secondSource, 'two')]);
    let control: 'stop' | undefined;
    const executed = await executeRenamePlan([
      { sourcePath: firstSource, targetPath: firstTarget },
      { sourcePath: secondSource, targetPath: secondTarget },
    ], path.join(root, 'history'), (completed) => { if (completed === 1) control = 'stop'; }, { control: () => control });

    expect(executed.operation.status).toBe('stopped');
    expect(executed.operation.items).toHaveLength(1);
    await expect(fs.promises.readFile(firstTarget, 'utf8')).resolves.toBe('one');
    await expect(fs.promises.readFile(secondSource, 'utf8')).resolves.toBe('two');
    await expect(fs.promises.stat(secondTarget)).rejects.toMatchObject({ code: 'ENOENT' });

    const undone = await undoRenameOperation(executed.operation, executed.logPath);
    expect(undone.status).toBe('undone');
    await expect(fs.promises.readFile(firstSource, 'utf8')).resolves.toBe('one');
  });

  it('undoes completed files immediately when undo is requested during a rename', async () => {
    const root = await temporaryDirectory();
    const firstSource = path.join(root, 'incoming', 'One.mkv');
    const secondSource = path.join(root, 'incoming', 'Two.mkv');
    const firstTarget = path.join(root, 'library', 'One.mkv');
    const secondTarget = path.join(root, 'library', 'Two.mkv');
    await fs.promises.mkdir(path.dirname(firstSource), { recursive: true });
    await Promise.all([fs.promises.writeFile(firstSource, 'one'), fs.promises.writeFile(secondSource, 'two')]);
    let control: 'undo' | undefined;
    const phases: string[] = [];
    const executed = await executeRenamePlan([
      { sourcePath: firstSource, targetPath: firstTarget },
      { sourcePath: secondSource, targetPath: secondTarget },
    ], path.join(root, 'history'), (completed, _total, operation) => {
      phases.push(`${operation}:${completed}`);
      if (operation === 'rename' && completed === 1) control = 'undo';
    }, { control: () => control });

    expect(executed.operation.status).toBe('undone');
    expect(phases).toEqual(['rename:1', 'undo:1']);
    await expect(fs.promises.readFile(firstSource, 'utf8')).resolves.toBe('one');
    await expect(fs.promises.readFile(secondSource, 'utf8')).resolves.toBe('two');
    await expect(fs.promises.stat(firstTarget)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.promises.stat(secondTarget)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('optionally removes empty source folders after moving', async () => {
    const root = await temporaryDirectory();
    const emptyAfterMove = path.join(root, 'incoming', 'Some Show');
    const stillOccupied = path.join(root, 'incoming', 'Another Show');
    const firstSource = path.join(emptyAfterMove, 'Episode 1.mkv');
    const secondSource = path.join(stillOccupied, 'Episode 2.mkv');
    await Promise.all([fs.promises.mkdir(emptyAfterMove, { recursive: true }), fs.promises.mkdir(stillOccupied, { recursive: true })]);
    await Promise.all([fs.promises.writeFile(firstSource, 'one'), fs.promises.writeFile(secondSource, 'two'), fs.promises.writeFile(path.join(stillOccupied, 'keep.txt'), 'keep')]);
    const executed = await executeRenamePlan([
      { sourcePath: firstSource, targetPath: path.join(root, 'library', 'Some Show', 'Episode 1.mkv') },
      { sourcePath: secondSource, targetPath: path.join(root, 'library', 'Another Show', 'Episode 2.mkv') },
    ], path.join(root, 'history'), undefined, { removeEmptySourceParents: true });

    await expect(fs.promises.stat(emptyAfterMove)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.promises.readFile(path.join(stillOccupied, 'keep.txt'), 'utf8')).resolves.toBe('keep');
    expect(executed.operation.removedSourceDirectories).toEqual([emptyAfterMove]);
    await undoRenameOperation(executed.operation, executed.logPath);
    await expect(fs.promises.readFile(firstSource, 'utf8')).resolves.toBe('one');
  });

  it('removes an emptied subtitle folder without removing its occupied release folder', async () => {
    const root = await temporaryDirectory();
    const sourceDirectory = path.join(root, 'incoming', 'Movie');
    const subtitlesDirectory = path.join(sourceDirectory, 'Subs');
    const videoSource = path.join(sourceDirectory, 'Movie.mkv');
    const subtitleSource = path.join(subtitlesDirectory, 'English.srt');
    await fs.promises.mkdir(subtitlesDirectory, { recursive: true });
    await Promise.all([
      fs.promises.writeFile(videoSource, 'video'),
      fs.promises.writeFile(subtitleSource, 'subtitle'),
      fs.promises.writeFile(path.join(sourceDirectory, 'keep.txt'), 'keep'),
    ]);

    const executed = await executeRenamePlan([
      { sourcePath: videoSource, targetPath: path.join(root, 'library', 'Movie', 'Movie.mkv') },
      { sourcePath: subtitleSource, targetPath: path.join(root, 'library', 'Movie', 'Movie.srt') },
    ], path.join(root, 'history'), undefined, { removeEmptySourceParents: true });

    await expect(fs.promises.stat(subtitlesDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.promises.readFile(path.join(sourceDirectory, 'keep.txt'), 'utf8')).resolves.toBe('keep');
    expect(executed.operation.removedSourceDirectories).toContain(subtitlesDirectory);
    expect(executed.operation.removedSourceDirectories).not.toContain(sourceDirectory);
  });

  it('optionally clears only recognized source junk and removes emptied nested folders', async () => {
    const root = await temporaryDirectory();
    const sourceDirectory = path.join(root, 'incoming', 'Movie');
    const nestedDirectory = path.join(sourceDirectory, 'Other');
    const subtitlesDirectory = path.join(sourceDirectory, 'Subs');
    const source = path.join(sourceDirectory, 'Movie.mp4');
    const target = path.join(root, 'library', 'Movie', 'Movie.mp4');
    await Promise.all([fs.promises.mkdir(nestedDirectory, { recursive: true }), fs.promises.mkdir(subtitlesDirectory, { recursive: true })]);
    await Promise.all([
      fs.promises.writeFile(source, 'video'),
      fs.promises.writeFile(path.join(sourceDirectory, 'www.YTS.MX.jpg'), 'advert'),
      fs.promises.writeFile(path.join(sourceDirectory, 'YIFYStatus.com.txt'), 'advert'),
      fs.promises.writeFile(path.join(sourceDirectory, 'YTSProxies.com.txt'), 'advert'),
      fs.promises.writeFile(path.join(sourceDirectory, 'YTS.GG - Official site.jpg'), 'advert'),
      fs.promises.writeFile(path.join(sourceDirectory, 'www.YTS.LT.jpg'), 'advert'),
      fs.promises.writeFile(path.join(sourceDirectory, 'WWW.YTS.RE.jpg'), 'advert'),
      fs.promises.writeFile(path.join(sourceDirectory, 'www.YTS.TO.jpg'), 'advert'),
      fs.promises.writeFile(path.join(sourceDirectory, 'YTSYifyUP.com (TOR).txt'), 'advert'),
      fs.promises.writeFile(path.join(sourceDirectory, 'Assassins.1995.1080p.BluRay.x264.YIFY.srt'), ''),
      fs.promises.writeFile(path.join(sourceDirectory, 'Movie.srt'), '1\n00:00:01,000 --> 00:00:02,000\nSubtitle'),
      fs.promises.writeFile(path.join(nestedDirectory, 'WWW.YIFY-TORRENTS.COM.jpg'), 'advert'),
      fs.promises.writeFile(path.join(nestedDirectory, 'Torrent downloaded from Demonoid.com - Copy.txt'), 'advert'),
      fs.promises.writeFile(path.join(nestedDirectory, 'Torrent Downloaded From ExtraTorrent.com.txt'), 'advert'),
      fs.promises.writeFile(path.join(nestedDirectory, 'Torrent Downloaded From ExtraTorrent.cc.txt'), 'advert'),
      fs.promises.writeFile(path.join(nestedDirectory, 'AhaShare.com.txt'), 'advert'),
      fs.promises.writeFile(path.join(nestedDirectory, 'Torrent_downloaded_from_Demonoid_-_www.demonoid.pw_.txt'), 'advert'),
      fs.promises.writeFile(path.join(nestedDirectory, 'Torrent Downloaded From Unlock.org    .txt'), 'advert'),
      fs.promises.writeFile(path.join(nestedDirectory, '__CheerfulTomato.txt'), 'advert'),
      fs.promises.writeFile(path.join(nestedDirectory, 'bilgi.txt'), 'advert'),
      fs.promises.writeFile(path.join(nestedDirectory, 'screenshot_1_1080p.jpg'), 'advert'),
      fs.promises.writeFile(path.join(nestedDirectory, 'screenshot_2_1080p.jpg'), 'advert'),
      fs.promises.writeFile(path.join(nestedDirectory, 'screenshot_3_1080p.jpg'), 'advert'),
      fs.promises.writeFile(path.join(subtitlesDirectory, 'English.srt'), 'subtitle'),
      fs.promises.writeFile(path.join(sourceDirectory, 'keep.txt'), 'keep'),
      fs.promises.writeFile(path.join(sourceDirectory, 'Torrent downloaded from Example.com.txt'), 'keep'),
      fs.promises.writeFile(path.join(sourceDirectory, 'Torrent notes.txt'), 'keep'),
      fs.promises.writeFile(path.join(sourceDirectory, 'www.example.com.jpg'), 'keep'),
    ]);

    const executed = await executeRenamePlan([{ sourcePath: source, targetPath: target }], path.join(root, 'history'), undefined, {
      clearSourceJunk: true,
      removeEmptySourceParents: true,
    });

    expect(executed.operation.removedSourceJunkFiles).toHaveLength(21);
    expect(executed.operation.removedSourceDirectories).toContain(nestedDirectory);
    await expect(fs.promises.stat(nestedDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.promises.readFile(path.join(sourceDirectory, 'keep.txt'), 'utf8')).resolves.toBe('keep');
    await expect(fs.promises.readFile(path.join(sourceDirectory, 'Torrent downloaded from Example.com.txt'), 'utf8')).resolves.toBe('keep');
    await expect(fs.promises.readFile(path.join(sourceDirectory, 'Torrent notes.txt'), 'utf8')).resolves.toBe('keep');
    await expect(fs.promises.readFile(path.join(sourceDirectory, 'www.example.com.jpg'), 'utf8')).resolves.toBe('keep');
    await expect(fs.promises.readFile(path.join(sourceDirectory, 'Movie.srt'), 'utf8')).resolves.toContain('Subtitle');
    await expect(fs.promises.readFile(path.join(subtitlesDirectory, 'English.srt'), 'utf8')).resolves.toBe('subtitle');
  });

  it('optionally writes a timestamped log to the common destination folder', async () => {
    const root = await temporaryDirectory();
    const source = path.join(root, 'incoming', 'Episode.mkv');
    const target = path.join(root, 'library', 'Some Show', 'Season 1', 'Episode.mkv');
    await fs.promises.mkdir(path.dirname(source), { recursive: true });
    await fs.promises.writeFile(source, 'video');
    const executed = await executeRenamePlan([{ sourcePath: source, targetPath: target }], path.join(root, 'history'), undefined, { createExternalLog: true });

    expect(executed.operation.externalLogPath).toMatch(new RegExp(`^${path.dirname(target).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*media-renamer-`));
    await expect(fs.promises.readFile(executed.operation.externalLogPath!, 'utf8')).resolves.toContain(executed.operation.id);
  });

  it('keeps a successful rename when the optional external log cannot be written', async () => {
    const root = await temporaryDirectory();
    const source = path.join(root, 'incoming', 'Episode.mkv');
    const target = path.join(root, 'library', 'Episode.mkv');
    const invalidLogDirectory = path.join(root, 'not-a-directory');
    await fs.promises.mkdir(path.dirname(source), { recursive: true });
    await fs.promises.writeFile(source, 'video');
    await fs.promises.writeFile(invalidLogDirectory, 'occupied');
    const executed = await executeRenamePlan([{ sourcePath: source, targetPath: target }], path.join(root, 'history'), undefined, { createExternalLog: true, externalLogDirectory: invalidLogDirectory });

    await expect(fs.promises.readFile(target, 'utf8')).resolves.toBe('video');
    expect(executed.operation.externalLogPath).toBeUndefined();
    expect(executed.operation.externalLogWarning).toContain('Could not write');
  });

  it('recovers the latest valid operation from durable history', async () => {
    const root = await temporaryDirectory();
    const history = path.join(root, 'history');
    const source = path.join(root, 'Old.mkv');
    const target = path.join(root, 'New.mkv');
    await fs.promises.writeFile(source, 'video');
    const executed = await executeRenamePlan([{ sourcePath: source, targetPath: target }], history);
    await fs.promises.writeFile(path.join(history, 'zzzz-corrupt.json'), '{not json');
    const recovered = await readLatestRenameOperation(history);
    expect(recovered?.operation.id).toBe(executed.operation.id);
    expect(recovered?.logPath).toBe(executed.logPath);
  });

  it('rejects the full plan before moving anything when a target exists', async () => {
    const root = await temporaryDirectory();
    const first = path.join(root, 'one.mkv');
    const second = path.join(root, 'two.mkv');
    const occupied = path.join(root, 'occupied.mkv');
    await Promise.all([fs.promises.writeFile(first, 'one'), fs.promises.writeFile(second, 'two'), fs.promises.writeFile(occupied, 'occupied')]);
    await expect(executeRenamePlan([
      { sourcePath: first, targetPath: path.join(root, 'renamed.mkv') },
      { sourcePath: second, targetPath: occupied },
    ], path.join(root, 'history'))).rejects.toThrow(/preflight failed/i);
    await expect(fs.promises.readFile(first, 'utf8')).resolves.toBe('one');
  });

  it('increments a colliding video and all of its companions together', async () => {
    const root = await temporaryDirectory();
    const target = path.join(root, 'Show - S01E01.mkv');
    await fs.promises.writeFile(target, 'occupied');
    const [group] = await resolveRenameCollisions([{ items: [
      { sourcePath: path.join(root, 'old.mkv'), targetPath: target },
      { sourcePath: path.join(root, 'old.en.srt'), targetPath: path.join(root, 'Show - S01E01.en.srt') },
    ] }]);
    expect(group.items.map((item) => path.basename(item.targetPath))).toEqual(['Show - S01E01 (2).mkv', 'Show - S01E01 (2).en.srt']);
  });

  it('keeps the first duplicate episode name and increments later duplicates', async () => {
    const root = await temporaryDirectory();
    const firstSource = path.join(root, 'first.mkv');
    const secondSource = path.join(root, 'second.mkv');
    const thirdSource = path.join(root, 'third.mkv');
    await Promise.all([firstSource, secondSource, thirdSource].map((source) => fs.promises.writeFile(source, 'video')));
    const target = path.join(root, 'VisionQuest (2026) - S01E02 - Theseus.mkv');
    const groups = await resolveRenameCollisions([firstSource, secondSource, thirdSource].map((sourcePath) => ({ items: [{ sourcePath, targetPath: target }] })));
    expect(groups.map((group) => path.basename(group.items[0].targetPath))).toEqual([
      'VisionQuest (2026) - S01E02 - Theseus.mkv',
      'VisionQuest (2026) - S01E02 - Theseus (2).mkv',
      'VisionQuest (2026) - S01E02 - Theseus (3).mkv',
    ]);
  });
});
