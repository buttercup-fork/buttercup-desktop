import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * A new custom field can't be saved without a name, and said so only in the
 * tooltip of the disabled Save button, which often doesn't show (#1394).
 */
test.describe("untitled custom field", () => {
    let launched: LaunchedApp;
    let vaultDir: string;

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
    });

    test.afterAll(async () => {
        await launched?.close();
        rmSync(vaultDir, { recursive: true, force: true });
    });

    test("opens the new field's name and says why Save is disabled", async () => {
        const { window } = launched;
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        const reason = window.getByText("Give every custom field a name to save");
        await window.getByRole("button", { name: "Add Vault" }).click();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await window.getByRole("button", { name: "New Entry" }).click();
        // A new entry focuses its title shortly after opening: wait for it, so
        // it doesn't take the focus from the custom field added below
        await expect(window.getByPlaceholder("Title")).toBeFocused();
        await window.getByPlaceholder("Title").fill("Bank");
        const save = window.getByRole("button", { name: "Save" });
        await expect(reason).toHaveCount(0);
        await window.getByRole("button", { name: "Add Custom Field" }).click();
        // The untitled field's name is open for typing and highlighted
        await expect(window.locator(".bp4-editable-text-input")).toBeFocused();
        await expect(window.locator(".bp4-editable-text.bp4-intent-warning")).toHaveCount(1);
        await expect(save).toBeDisabled();
        await expect(reason).toBeVisible();
        // Typing goes straight into the name
        await window.keyboard.type("pin");
        await window.keyboard.press("Enter");
        await expect(window.locator(".bp4-editable-text.bp4-intent-warning")).toHaveCount(0);
        await expect(reason).toHaveCount(0);
        await window.getByRole("textbox").last().fill("1234");
        await expect(save).toBeEnabled();
        await save.click();
        await expect(window.getByText("pin", { exact: true })).toBeVisible();
        await expect(window.locator("span", { hasText: /^1234$/ })).toBeVisible();
    });
});
