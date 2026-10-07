import { buildEditMenuTemplate, type EditMenuParams } from "./editMenu";

const flags = {
    canUndo: false,
    canRedo: false,
    canCut: false,
    canCopy: false,
    canPaste: true,
    canSelectAll: true
};

function params(overrides: Partial<EditMenuParams>): EditMenuParams {
    return { isEditable: false, selectionText: "", editFlags: flags, ...overrides };
}

describe("buildEditMenuTemplate", () => {
    test("an input gets undo, redo, cut, copy, paste and select all", () => {
        const roles = buildEditMenuTemplate(params({ isEditable: true })).map(
            (item) => item.role ?? item.type
        );
        expect(roles).toEqual([
            "undo",
            "redo",
            "separator",
            "cut",
            "copy",
            "paste",
            "separator",
            "selectAll"
        ]);
    });

    test("items follow what the page says can be done", () => {
        const items = buildEditMenuTemplate(
            params({
                isEditable: true,
                selectionText: "abc",
                editFlags: { ...flags, canCut: true, canCopy: true, canPaste: false }
            })
        );
        const enabled = (role: string) => items.find((item) => item.role === role)?.enabled;
        expect(enabled("cut")).toBe(true);
        expect(enabled("copy")).toBe(true);
        expect(enabled("paste")).toBe(false);
        expect(enabled("undo")).toBe(false);
    });

    test("selected text outside an input can be copied", () => {
        const items = buildEditMenuTemplate(
            params({ selectionText: "hello", editFlags: { ...flags, canCopy: true } })
        );
        expect(items.map((item) => item.role ?? item.type)).toEqual([
            "copy",
            "separator",
            "selectAll"
        ]);
    });

    test("plain page text with nothing selected gets no menu", () => {
        expect(buildEditMenuTemplate(params({}))).toEqual([]);
    });
});
