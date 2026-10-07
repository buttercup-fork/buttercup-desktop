import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { test, expect, type Locator } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * A long note filled the whole entry pane, in both view and edit mode (B-458).
 * It now shows about 10 lines with "Show more"; the edit box scrolls instead.
 */
test.describe("long notes", () => {
    let launched: LaunchedApp;
    let vaultDir: string;

    const isCut = (locator: Locator) =>
        locator.evaluate(el => el.scrollHeight > el.clientHeight + 1);

    test.beforeAll(async () => {
        launched = await launchApp();
        vaultDir = mkdtempSync(join(tmpdir(), "buttercup-e2e-vault-"));
        // Stand in for the native "new vault" save dialog
        await launched.app.evaluate(
            ({ dialog }, filePath) => {
                dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as any;
            },
            join(vaultDir, "test.bcup")
        );
        const { window } = launched;
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        await window.getByRole("button", { name: "Add Vault" }).click();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
    });

    test.afterAll(async () => {
        await launched?.close();
        rmSync(vaultDir, { recursive: true, force: true });
    });

    async function addEntry(title: string, note: string) {
        const { window } = launched;
        await window.getByRole("button", { name: "New Entry" }).click();
        // A new entry focuses its title shortly after opening
        await expect(window.getByPlaceholder("Title")).toBeFocused();
        await window.getByPlaceholder("Title").fill(title);
        // A custom field of type Note (login entries have no note by default)
        await window.getByRole("button", { name: "Add Custom Field" }).click();
        await window.keyboard.type("notes");
        await window.keyboard.press("Enter");
        await window.locator(".bp4-button:has(.bp4-icon-cog)").last().click();
        await window.getByRole("menuitem", { name: "Change Type: Note" }).click();
        const noteBox = window.locator("textarea.bp4-input");
        await noteBox.fill(note);
        return noteBox;
    }

    test("a long note is collapsed with Show more, and its edit box scrolls", async () => {
        const { window } = launched;
        const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n");
        const noteBox = await addEntry("Long note", lines);
        // Editing: the box stops growing and scrolls
        expect(await isCut(noteBox)).toBe(true);
        await window.getByRole("button", { name: "Save" }).click();

        const note = window.getByTestId("note-value");
        await expect(note).toBeVisible();
        expect(await isCut(note)).toBe(true);
        // Right after saving, the entry's fields are rebuilt with new ids and mount
        // again (core makes a new id for every field each time), which would undo an
        // expansion in progress. Retry the whole step until it holds.
        await expect(async () => {
            await window.getByRole("button", { name: "Show more" }).click({ timeout: 2000 });
            await expect(window.getByRole("button", { name: "Show less" })).toBeVisible({ timeout: 2000 });
            expect(await isCut(note)).toBe(false);
            await window.getByRole("button", { name: "Show less" }).click({ timeout: 2000 });
            await expect(window.getByRole("button", { name: "Show more" })).toBeVisible({ timeout: 2000 });
            expect(await isCut(note)).toBe(true);
        }).toPass({ timeout: 15000 });
    });

    test("a 5,884-character string without spaces wraps and is collapsed", async () => {
        const { window } = launched;
        const secret = Array.from({ length: 5884 }, (_, i) => "abcdefghij0123456789"[i % 20]).join("");
        await addEntry("Long secret", secret);
        await window.getByRole("button", { name: "Save" }).click();
        const note = window.getByTestId("note-value");
        await expect(note).toBeVisible();
        expect(await isCut(note)).toBe(true);
        // Wraps inside the pane instead of running off to the right
        expect(await note.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        await expect(window.getByRole("button", { name: "Show more" })).toBeVisible();
    });

    test("a short note has no Show more button", async () => {
        const { window } = launched;
        await addEntry("Short note", "just\ntwo lines");
        await window.getByRole("button", { name: "Save" }).click();
        await expect(window.getByTestId("note-value")).toHaveText("just\ntwo lines");
        await expect(window.getByRole("button", { name: "Show more" })).toHaveCount(0);
    });
});
