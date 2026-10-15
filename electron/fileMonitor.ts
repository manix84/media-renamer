import fs from 'node:fs';
import path from 'node:path';

type FileIdentity = { dev: number; ino: number };
type TrackedFile = FileIdentity & { path: string };
export type WatchedFileChange = { type: 'moved'; previousPath: string; path: string } | { type: 'deleted'; path: string };

function identityKey(value: FileIdentity): string {
  return `${value.dev}:${value.ino}`;
}

async function identity(filePath: string): Promise<FileIdentity | undefined> {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.isFile() ? { dev: stats.dev, ino: stats.ino } : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function filesBelow(directory: string, remaining: { value: number }): Promise<string[]> {
  if (remaining.value <= 0) return [];
  let entries: fs.Dirent[];
  try { entries = await fs.promises.readdir(directory, { withFileTypes: true }); }
  catch { return []; }
  const files: string[] = [];
  for (const entry of entries) {
    if (remaining.value-- <= 0) break;
    const candidate = path.join(directory, entry.name);
    if (entry.isFile()) files.push(candidate);
    else if (entry.isDirectory()) files.push(...await filesBelow(candidate, remaining));
  }
  return files;
}

export async function reconcileTrackedFiles(tracked: TrackedFile[]): Promise<WatchedFileChange[]> {
  const missing: TrackedFile[] = [];
  for (const item of tracked) if (!await identity(item.path)) missing.push(item);
  if (!missing.length) return [];

  const wanted = new Map(missing.map((item) => [identityKey(item), item]));
  const found = new Map<string, string>();
  const remaining = { value: 5000 };
  for (const directory of new Set(tracked.map((item) => path.dirname(item.path)))) {
    for (const candidate of await filesBelow(directory, remaining)) {
      const candidateIdentity = await identity(candidate).catch(() => undefined);
      if (candidateIdentity && wanted.has(identityKey(candidateIdentity))) found.set(identityKey(candidateIdentity), candidate);
    }
  }

  return missing.map((item) => {
    const nextPath = found.get(identityKey(item));
    return nextPath ? { type: 'moved', previousPath: item.path, path: nextPath } : { type: 'deleted', path: item.path };
  });
}

export class MediaFileMonitor {
  private tracked = new Map<string, TrackedFile>();
  private watchers = new Map<string, fs.FSWatcher>();
  private timer: NodeJS.Timeout | undefined;
  private generation = 0;

  constructor(private readonly onChanges: (changes: WatchedFileChange[]) => void) {}

  async setPaths(paths: string[]): Promise<void> {
    const generation = ++this.generation;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    const entries = await Promise.all(paths.map(async (filePath) => {
      const value = await identity(filePath);
      return value ? { path: filePath, ...value } : undefined;
    }));
    if (generation !== this.generation) return;
    this.tracked = new Map(entries.filter((item): item is TrackedFile => Boolean(item)).map((item) => [item.path, item]));
    this.replaceWatchers();
  }

  close(): void {
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    for (const watcher of this.watchers.values()) watcher.close();
    this.watchers.clear();
    this.tracked.clear();
  }

  private replaceWatchers(): void {
    const directories = new Set([...this.tracked.keys()].map((filePath) => path.dirname(filePath)));
    for (const [directory, watcher] of this.watchers) {
      if (!directories.has(directory)) { watcher.close(); this.watchers.delete(directory); }
    }
    for (const directory of directories) {
      if (this.watchers.has(directory)) continue;
      try {
        const watcher = fs.watch(directory, () => this.scheduleReconcile());
        watcher.on('error', () => { watcher.close(); this.watchers.delete(directory); });
        this.watchers.set(directory, watcher);
      } catch {
        // A vanished or inaccessible directory is handled by the next registration.
      }
    }
  }

  private scheduleReconcile(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.reconcile(), 250);
  }

  private async reconcile(): Promise<void> {
    this.timer = undefined;
    const generation = this.generation;
    const changes = await reconcileTrackedFiles([...this.tracked.values()]);
    if (!changes.length || generation !== this.generation) return;
    for (const change of changes) {
      if (change.type === 'deleted') this.tracked.delete(change.path);
      else {
        const item = this.tracked.get(change.previousPath);
        this.tracked.delete(change.previousPath);
        if (item) this.tracked.set(change.path, { ...item, path: change.path });
      }
    }
    this.replaceWatchers();
    this.onChanges(changes);
  }
}
