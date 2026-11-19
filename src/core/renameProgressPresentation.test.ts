import { describe, expect, it } from 'vitest';
import { renameFilePhaseLabel, renameFileProgressPresentation } from './renameProgressPresentation';

const progress = { sourcePath: '/incoming/Movie.mkv', targetPath: '/library/Movie/Movie.mkv', fraction: .99 } as const;

describe('rename file progress presentation', () => {
  it('provides compact one-word labels for row progress', () => {
    expect(['preparing', 'renaming', 'copying', 'flushing', 'publishing', 'removing-source'].map((phase) => renameFilePhaseLabel(phase as Parameters<typeof renameFilePhaseLabel>[0]))).toEqual([
      'Preparing', 'Renaming', 'Copying', 'Flushing', 'Finalising', 'Removing',
    ]);
  });

  it('explains the gap between bytes copied and destination completion', () => {
    expect(renameFileProgressPresentation({ ...progress, phase: 'flushing', totalBytes: 4 * 1024 ** 3 }, 5_000)).toEqual({
      title: 'Waiting for destination storage',
      detail: '4.0 GiB has been copied, but the destination is still finishing buffered writes. Network shares and external drives can take longer here.',
      stalled: false,
    });
  });

  it('warns when the current stage has stopped reporting progress', () => {
    const result = renameFileProgressPresentation({ ...progress, phase: 'copying', bytesCopied: 512, totalBytes: 1024 }, 125_000);
    expect(result.stalled).toBe(true);
    expect(result.detail).toContain('No progress update has arrived for 2m 5s');
    expect(result.detail).toContain('destination may be busy');
  });
});
