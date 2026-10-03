import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * A custom field may not reuse a name already taken in the entry (#1159):
 * saving would keep only one of the two values and silently erase the other.
 */
test.describe("duplicate field names", () => {
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

    test("blocks saving until the clashing field is renamed", async () => {
        const { window } = launched;
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        await window.getByRole("button", { name: "Add Vault" }).click();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        // New login entry with a username
        await window.getByRole("button", { name: "New Entry" }).click();
        await window.getByPlaceholder("Title").fill("Bank");
        await window.getByPlaceholder("Username").fill("alice");
        const save = window.getByRole("button", { name: "Save" });
        // A custom field named like the built-in username field
        await window.getByRole("button", { name: "Add Custom Field" }).click();
        await window.getByText("Click to edit").click();
        await window.keyboard.type("username");
        await window.keyboard.press("Enter");
        // Custom fields come after the built-in ones
        await window.getByRole("textbox").last().fill("1234");
        await expect(save).toBeDisabled();
        await expect(save).toHaveAttribute(
            "title",
            "Two fields have the same name: rename or remove one"
        );
        await expect(window.locator(".bp4-editable-text.bp4-intent-danger")).toHaveCount(1);
        // Renaming it clears the clash
        await window.locator(".bp4-editable-text").click();
        await window.keyboard.press("ControlOrMeta+A");
        await window.keyboard.type("pin");
        await window.keyboard.press("Enter");
        await expect(window.locator(".bp4-editable-text.bp4-intent-danger")).toHaveCount(0);
        await expect(save).toBeEnabled();
        await save.click();
        // Both values survived the save (the details pane shows values in spans)
        await expect(window.getByRole("button", { name: "Edit" })).toBeVisible();
        await expect(window.locator("span", { hasText: /^alice$/ })).toBeVisible();
        await expect(window.locator("span", { hasText: /^1234$/ })).toBeVisible();
        await expect(window.getByText("pin", { exact: true })).toBeVisible();
    });
});
