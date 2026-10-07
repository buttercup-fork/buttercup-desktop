import type { MenuItemConstructorOptions } from "electron";

export interface EditMenuParams {
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

/**
 * The right-click menu for text: Electron shows none by itself, so inputs had no
 * way to paste or cut with the mouse (#773). The roles take their labels from the
 * system language. Returns an empty list where there is nothing to offer.
 * @param params What the page reported about the click
 */
export function buildEditMenuTemplate(params: EditMenuParams): Array<MenuItemConstructorOptions> {
    const { editFlags, isEditable, selectionText } = params;
    if (isEditable) {
        return [
            { role: "undo", enabled: editFlags.canUndo },
            { role: "redo", enabled: editFlags.canRedo },
            { type: "separator" },
            { role: "cut", enabled: editFlags.canCut },
            { role: "copy", enabled: editFlags.canCopy },
            { role: "paste", enabled: editFlags.canPaste },
            { type: "separator" },
            { role: "selectAll", enabled: editFlags.canSelectAll }
        ];
    }
    if (selectionText && editFlags.canCopy) {
        return [{ role: "copy" }, { type: "separator" }, { role: "selectAll" }];
    }
    return [];
}
