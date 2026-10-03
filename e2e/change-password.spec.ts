import { join } from "path";
import { mkdtempSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * Change a vault's master password from Vault Settings (#1046): a backup is
 * written first, and afterwards only the new password unlocks the vault.
 */
test.describe("change master password", () => {
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

    test("changes the password, keeps a backup and unlocks with the new one", async () => {
        const { app, window } = launched;
        const vaultTab = window.getByText("test", { exact: true }).first();
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        // Create a file vault
        await window.getByRole("button", { name: "Add Vault" }).click();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        await passwordPrompt.fill("old-pass");
        await passwordPrompt.press("Enter");
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();
        // Open the Password page of the vault settings
        await vaultTab.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Vault settings" }).click();
        const settings = window.locator(".bp4-dialog", { hasText: "Vault Settings" });
        const confirm = window.locator(".bp4-dialog", { hasText: "Change master password?" });
        await settings.getByRole("button", { name: "Password" }).click();
        const inputs = settings.locator("input[type=password]");
        const changeButton = settings.getByRole("button", { name: "Change password" });
        await expect(changeButton).toBeDisabled();
        // Confirmation must match
        await inputs.nth(0).fill("wrong-pass");
        await inputs.nth(1).fill("new-pass");
        await inputs.nth(2).fill("new-pas");
        await expect(settings.getByText("The passwords do not match")).toBeVisible();
        await expect(changeButton).toBeDisabled();
        await inputs.nth(2).fill("new-pass");
        // A wrong current password is refused
        await changeButton.click();
        await confirm.getByRole("button", { name: "Change password" }).click();
        await expect(window.getByText("The current password is not correct")).toBeVisible();
        await expect(confirm).toBeHidden();
        // The right one changes it and clears the fields
        await inputs.nth(0).fill("old-pass");
        await changeButton.click();
        await confirm.getByRole("button", { name: "Change password" }).click();
        await expect(window.getByText(/Master password changed/)).toBeVisible();
        await expect(inputs.nth(0)).toHaveValue("");
        await settings.getByRole("button", { name: "Cancel" }).click();
        await expect(settings).toBeHidden();
        // The backup was written
        const home = await app.evaluate(() => process.env.BUTTERCUP_HOME_DIR);
        const backups = (readdirSync(home, { recursive: true } as any) as Array<string>).filter(
            (file) => /password-change_.*\.bcup$/.test(file)
        );
        expect(backups).toHaveLength(1);
        // Lock: the old password no longer unlocks, the new one does
        await vaultTab.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Lock vault", exact: true }).click();
        await vaultTab.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Unlock vault", exact: true }).click();
        await passwordPrompt.fill("old-pass");
        await passwordPrompt.press("Enter");
        await expect(window.getByText(/Vault unlock failed/)).toBeVisible();
        await expect(window.getByRole("button", { name: "New Entry" })).toBeHidden();
        // The prompt stays open after a failed attempt
        await passwordPrompt.fill("new-pass");
        await passwordPrompt.press("Enter");
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();
    });
});
