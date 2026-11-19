import { describe, expect, it } from 'vitest';
import { notificationTestContent, renameCompletionNotification, renameFailureNotification } from './completionNotification';
import type { RenameOperation } from './renameExecution';

function operation(status: RenameOperation['status'], count: number): RenameOperation {
  return {
    id: 'operation-1',
    createdAt: new Date(0).toISOString(),
    status,
    items: Array.from({ length: count }, (_, index) => ({ sourcePath: `/source/${index}.mkv`, targetPath: `/target/${index}.mkv` })),
  };
}

describe('native completion notification copy', () => {
  it('describes completed moves and in-place renames', () => {
    expect(renameCompletionNotification(operation('completed', 1), false)).toEqual({ title: 'Rename complete', body: '1 file renamed successfully.' });
    expect(renameCompletionNotification(operation('completed', 2), true)).toEqual({ title: 'Rename complete', body: '2 files moved and renamed successfully.' });
  });

  it('describes stopped and undone operations', () => {
    expect(renameCompletionNotification(operation('stopped', 2), true)).toEqual({ title: 'Rename stopped', body: '2 files completed before the operation stopped.' });
    expect(renameCompletionNotification(operation('undone', 1), false)).toEqual({ title: 'Rename undone', body: '1 file restored to its original location.' });
  });

  it('explains that completed files are kept after a later failure', () => {
    const failed = operation('failed', 2);
    failed.failure = 'Destination became unavailable.';
    expect(renameCompletionNotification(failed, true)).toEqual({
      title: 'Rename failed',
      body: '2 files completed and were kept. Destination became unavailable.',
    });
  });

  it('keeps failure detail in the notification', () => {
    expect(renameFailureNotification('Destination is unavailable.')).toEqual({ title: 'Rename failed', body: 'Destination is unavailable.' });
  });

  it('provides fixed copy for every manual notification test', () => {
    expect(notificationTestContent('success').title).toBe('Test: Rename complete');
    expect(notificationTestContent('stopped').title).toBe('Test: Rename stopped');
    expect(notificationTestContent('error').title).toBe('Test: Rename failed');
  });
});
