import type { MenuItemConstructorOptions } from 'electron';

export interface TextEditContext {
  isEditable: boolean;
  selectionText: string;
  editFlags: {
    canUndo: boolean;
    canRedo: boolean;
    canCut: boolean;
    canCopy: boolean;
    canPaste: boolean;
    canSelectAll: boolean;
  };
}

export function textEditContextMenu(context: TextEditContext): MenuItemConstructorOptions[] | undefined {
  if (!context.isEditable && !context.selectionText) return undefined;
  const { editFlags } = context;
  return [
    { role: 'undo', enabled: context.isEditable && editFlags.canUndo },
    { role: 'redo', enabled: context.isEditable && editFlags.canRedo },
    { type: 'separator' },
    { role: 'cut', enabled: context.isEditable && editFlags.canCut },
    { role: 'copy', enabled: editFlags.canCopy },
    { role: 'paste', enabled: context.isEditable && editFlags.canPaste },
    { type: 'separator' },
    { role: 'selectAll', enabled: editFlags.canSelectAll },
  ];
}
