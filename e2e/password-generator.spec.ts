import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * The password generator (the generator fork, which draws its random numbers
 * from Node's crypto) works in the app: it makes passwords from the default
 * character sets and "Use This" puts one into the entry's password field.
 */
test.describe("password generator", () => {
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

    test("generates passwords and fills the password field", async () => {
        const { window } = launched;
        await window.getByRole("button", { name: "New Entry" }).click();
        await expect(window.getByPlaceholder("Title")).toBeFocused();
        await window.locator("button:has([data-icon=key])").first().click();
        const popover = window.locator(".Popover-body");
        const shown = popover.locator("pre");
        await expect(shown).toHaveText(/^[A-Za-z0-9_-]{20}$/);
        const passwords = new Set<string>();
        for (let i = 0; i < 10; i += 1) {
            const previous = await shown.textContent();
            await popover.getByRole("button", { name: "Generate" }).click();
            await expect(shown).not.toHaveText(previous);
            const password = await shown.textContent();
            expect(password).toMatch(/^[A-Za-z0-9_-]{20}$/);
            passwords.add(password);
        }
        expect(passwords.size).toBe(10);
        const chosen = await shown.textContent();
        await popover.getByRole("button", { name: "Use This" }).click();
        await expect(popover).toBeHidden();
        await expect(window.getByRole("textbox", { name: "Password" })).toHaveValue(chosen);
    });
});
