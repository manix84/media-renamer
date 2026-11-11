import { describe, expect, it } from 'vitest';
import { textEditContextMenu, type TextEditContext } from './editContextMenu';

function context(overrides: Partial<TextEditContext> = {}): TextEditContext {
  return {
    isEditable: true,
    selectionText: 'token',
    editFlags: { canUndo: true, canRedo: true, canCut: true, canCopy: true, canPaste: true, canSelectAll: true },
    ...overrides,
  };
}

describe('textEditContextMenu', () => {
  it('offers the standard editing actions for inputs', () => {
    expect(textEditContextMenu(context())?.map((item) => item.role ?? item.type)).toEqual([
      'undo', 'redo', 'separator', 'cut', 'copy', 'paste', 'separator', 'selectAll',
    ]);
  });

  it('disables mutating actions for selected read-only text', () => {
    const menu = textEditContextMenu(context({ isEditable: false }));
    expect(menu?.find((item) => item.role === 'cut')?.enabled).toBe(false);
    expect(menu?.find((item) => item.role === 'copy')?.enabled).toBe(true);
    expect(menu?.find((item) => item.role === 'paste')?.enabled).toBe(false);
  });

  it('does not open an editing menu away from editable or selected text', () => {
    expect(textEditContextMenu(context({ isEditable: false, selectionText: '' }))).toBeUndefined();
  });
});
