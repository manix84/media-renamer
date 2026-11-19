export type RenameFileProgressView = {
  phase: 'preparing' | 'renaming' | 'copying' | 'flushing' | 'publishing' | 'removing-source';
  sourcePath: string;
  targetPath: string;
  fraction: number;
  bytesCopied?: number;
  totalBytes?: number;
};

export function renameFilePhaseLabel(phase: RenameFileProgressView['phase']): string {
  if (phase === 'preparing') return 'Preparing';
  if (phase === 'renaming') return 'Renaming';
  if (phase === 'copying') return 'Copying';
  if (phase === 'flushing') return 'Flushing';
  if (phase === 'publishing') return 'Finalising';
  return 'Removing';
}

function filename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let amount = value / 1024;
  let unit = units[0];
  for (const candidate of units.slice(1)) {
    if (amount < 1024) break;
    amount /= 1024;
    unit = candidate;
  }
  return `${amount >= 10 ? amount.toFixed(0) : amount.toFixed(1)} ${unit}`;
}

function duration(milliseconds: number): string {
  const seconds = Math.max(1, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

export function renameFileProgressPresentation(progress: RenameFileProgressView, idleMilliseconds: number): { title: string; detail: string; stalled: boolean } {
  const name = filename(progress.sourcePath);
  let title: string;
  let detail: string;
  if (progress.phase === 'copying') {
    title = `Copying ${name}`;
    detail = progress.bytesCopied !== undefined && progress.totalBytes !== undefined
      ? `${bytes(progress.bytesCopied)} of ${bytes(progress.totalBytes)} copied to the destination. The source is kept until the copy is safely published.`
      : 'Copying data to the destination. The source is kept until the copy is safely published.';
  } else if (progress.phase === 'flushing') {
    title = 'Waiting for destination storage';
    detail = `${progress.totalBytes === undefined ? 'All file data has been copied' : `${bytes(progress.totalBytes)} has been copied`}, but the destination is still finishing buffered writes. Network shares and external drives can take longer here.`;
  } else if (progress.phase === 'publishing') {
    title = 'Finalising the destination file';
    detail = `The completed temporary copy is being published as ${filename(progress.targetPath)}.`;
  } else if (progress.phase === 'removing-source') {
    title = 'Removing the original file';
    detail = 'The destination copy is complete. Media Renamer is now removing the original source file.';
  } else if (progress.phase === 'renaming') {
    title = `Renaming ${name}`;
    detail = 'Source and destination are on the same storage, so Media Renamer is completing an atomic rename.';
  } else {
    title = `Preparing ${name}`;
    detail = 'Checking the destination and selecting the safest move method.';
  }
  const stalled = idleMilliseconds >= 30_000;
  if (stalled) detail += ` No progress update has arrived for ${duration(idleMilliseconds)}; the destination may be busy, slow, or temporarily unavailable.`;
  return { title, detail, stalled };
}
