import { join } from "path";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * A master password that is being set (new vault, password change) needs at
 * least 8 characters and must not be a common password (B-758, ASVS v5.0.0-6.2.1
 * and 6.2.4). Unlocking an existing vault is not affected.
 */
test.describe("master password rules", () => {
    let launched: LaunchedApp;
    let vaultDir: string;
    let vaultPath: string;

    test.beforeAll(async () => {
        launched = await launchApp();
        vaultDir = mkdtempSync(join(tmpdir(), "buttercup-e2e-vault-"));
        vaultPath = join(vaultDir, "test.bcup");
        // Stand in for the native "new vault" save dialog
        await launched.app.evaluate(({ dialog }, filePath) => {
            dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as any;
        }, vaultPath);
        await launched.app.evaluate(({ nativeTheme }) => {
            nativeTheme.themeSource = "light";
        });
    });

    test.afterAll(async () => {
        await launched?.close();
        rmSync(vaultDir, { recursive: true, force: true });
    });

    test("a new vault needs 8 characters and no common password", async ({}, testInfo) => {
        const { window } = launched;
        const dialog = window.locator(".bp4-dialog", {
            hasText: "Enter a new primary vault password"
        });
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        const rules = dialog.getByTestId("new-password-rules");
        const finish = dialog.getByRole("button", { name: "Add Vault" });
        await window.getByRole("button", { name: "Add Vault" }).click();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        // The rule is shown before anything is typed
        await expect(rules).toHaveText(
            "At least 8 characters, any you like. 15 or more is better."
        );
        await expect(passwordPrompt).toHaveAttribute("aria-describedby", "new-password-rules");
        await expect(finish).toBeDisabled();
        // Too short: the button stays off and Enter does nothing
        await passwordPrompt.fill("Zq8#vLm");
        await expect(finish).toBeDisabled();
        await passwordPrompt.press("Enter");
        await expect(dialog).toBeVisible();
        // A common password, in any case, is refused with a reason
        await passwordPrompt.fill("Password1");
        await expect(rules).toHaveText("This is a common password. Choose another.");
        await expect(finish).toBeDisabled();
        await window.screenshot({ path: testInfo.outputPath("new-vault-common-light.png") });
        await passwordPrompt.press("Enter");
        await expect(dialog).toBeVisible();
        expect(existsSync(vaultPath)).toBe(false);
        // A good one is accepted
        await passwordPrompt.fill("pass-e2e-vault");
        await expect(rules).toHaveText(
            "At least 8 characters, any you like. 15 or more is better."
        );
        await expect(finish).toBeEnabled();
        await window.screenshot({ path: testInfo.outputPath("new-vault-ok-light.png") });
        await finish.click();
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();
        expect(existsSync(vaultPath)).toBe(true);
    });

    test("a changed password follows the same rules", async ({}, testInfo) => {
        const { app, window } = launched;
        const vaultTab = window.getByText("test", { exact: true }).first();
        await vaultTab.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Vault settings" }).click();
        const settings = window.locator(".bp4-dialog", { hasText: "Vault Settings" });
        await settings.getByRole("button", { name: "Password" }).click();
        const inputs = settings.locator("input[type=password]");
        const rules = settings.getByTestId("new-password-rules");
        const changeButton = settings.getByRole("button", { name: "Change password" });
        await expect(rules).toHaveText(
            "At least 8 characters, any you like. 15 or more is better."
        );
        await expect(inputs.nth(1)).toHaveAttribute(
            "aria-describedby",
            "new-master-password-rules"
        );
        await inputs.nth(0).fill("pass-e2e-vault");
        // Too short
        await inputs.nth(1).fill("Zq8#vLm");
        await inputs.nth(2).fill("Zq8#vLm");
        await expect(changeButton).toBeDisabled();
        // Common
        await inputs.nth(1).fill("ILOVEYOU");
        await inputs.nth(2).fill("ILOVEYOU");
        await expect(rules).toHaveText("This is a common password. Choose another.");
        await expect(changeButton).toBeDisabled();
        await window.screenshot({ path: testInfo.outputPath("change-common-light.png") });
        await app.evaluate(({ nativeTheme }) => {
            nativeTheme.themeSource = "dark";
        });
        await expect(window.locator("body.bp4-dark")).toHaveCount(1);
        await window.screenshot({ path: testInfo.outputPath("change-common-dark.png") });
        // Good
        await inputs.nth(1).fill("another-good-pass");
        await inputs.nth(2).fill("another-good-pass");
        await expect(changeButton).toBeEnabled();
        await window.screenshot({ path: testInfo.outputPath("change-ok-dark.png") });
    });
});
