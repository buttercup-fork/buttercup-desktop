import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { test, expect, type Page } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * Changing the type of a field that already has one was undone on save
 * (#1218): only a field's first change, from Text, stuck.
 */
test.describe("field type changes", () => {
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

    async function editEntry(window: Page) {
        // A save that's still finishing can drop the selection: retry until editing
        await expect(async () => {
            await window.getByText("Bank", { exact: true }).first().click();
            await window.getByRole("button", { name: "Edit" }).click({ timeout: 1000 });
            await expect(window.getByRole("button", { name: "Save" })).toBeVisible({ timeout: 1000 });
        }).toPass();
    }

    async function setFieldType(window: Page, type: string) {
        await editEntry(window);
        await window.locator(".bp4-button:has(.bp4-icon-cog)").last().click();
        await window.getByRole("menuitem", { name: `Change Type: ${type}` }).click();
        await window.getByRole("button", { name: "Save" }).click();
        await expect(window.getByRole("button", { name: "Edit" })).toBeVisible();
    }

    async function expectFieldType(window: Page, type: string) {
        await editEntry(window);
        await window.locator(".bp4-button:has(.bp4-icon-cog)").last().click();
        await expect(
            window.getByRole("menuitem", { name: `Change Type: ${type}` }).locator(".bp4-icon-small-tick")
        ).toHaveCount(1);
        await window.keyboard.press("Escape");
        await window.getByRole("button", { name: "Cancel" }).click();
    }

    test("keeps every change of a field's type", async () => {
        const { window } = launched;
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        const vaultTab = window.getByText("test", { exact: true }).first();
        await window.getByRole("button", { name: "Add Vault" }).click();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await window.getByRole("button", { name: "New Entry" }).click();
        await expect(window.getByPlaceholder("Title")).toBeFocused();
        await window.getByPlaceholder("Title").fill("Bank");
        await window.getByRole("button", { name: "Add Custom Field" }).click();
        await window.keyboard.type("pin");
        await window.keyboard.press("Enter");
        await window.getByRole("textbox").last().fill("1234");
        await window.getByRole("button", { name: "Save" }).click();
        // Text → Note worked before; Note → Password and back were undone
        await setFieldType(window, "Note");
        await setFieldType(window, "Password");
        await expectFieldType(window, "Password");
        await setFieldType(window, "Note");
        // Still a note after the vault is read back from its file
        await vaultTab.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Lock vault", exact: true }).click();
        await vaultTab.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Unlock vault", exact: true }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await expect(passwordPrompt).toBeHidden();
        await expectFieldType(window, "Note");
    });
});
