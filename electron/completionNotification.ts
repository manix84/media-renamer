import type { RenameOperation } from './renameExecution.js';

export type CompletionNotification = { title: string; body: string };
export type NotificationTestKind = 'success' | 'stopped' | 'error';

export function renameCompletionNotification(operation: RenameOperation, moved: boolean): CompletionNotification {
  const count = operation.items.length;
  const files = `${count} file${count === 1 ? '' : 's'}`;
  if (operation.status === 'completed') return {
    title: 'Rename complete',
    body: `${files} ${moved ? 'moved and renamed' : 'renamed'} successfully.`,
  };
  if (operation.status === 'undone') return {
    title: 'Rename undone',
    body: `${files} restored to ${count === 1 ? 'its' : 'their'} original location${count === 1 ? '' : 's'}.`,
  };
  if (operation.status === 'failed') return {
    title: 'Rename failed',
    body: `${files} completed and were kept. ${operation.failure ?? 'A later file could not be processed.'}`,
  };
  return {
    title: 'Rename stopped',
    body: `${files} completed before the operation stopped.`,
  };
}

export function renameFailureNotification(message: string): CompletionNotification {
  return { title: 'Rename failed', body: message || 'The rename operation ended unexpectedly.' };
}

export function notificationTestContent(kind: NotificationTestKind): CompletionNotification {
  if (kind === 'success') return { title: 'Test: Rename complete', body: 'The native success notification is working.' };
  if (kind === 'stopped') return { title: 'Test: Rename stopped', body: 'The native stopped notification is working.' };
  return { title: 'Test: Rename failed', body: 'The native failure notification is working.' };
}
