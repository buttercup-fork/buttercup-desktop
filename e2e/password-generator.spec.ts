import { join } from "path";
import { mkdtempSync, readFileSync, rmSync } from "fs";
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
        await passwordPrompt.fill("pass-e2e-vault");
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

    test("with no character sets there is no password to use or copy (B-667)", async () => {
        const { window } = launched;
        const passwordField = window.getByRole("textbox", { name: "Password" });
        const before = await passwordField.inputValue();
        await window.locator("button:has([data-icon=key])").first().click();
        const popover = window.locator(".Popover-body");
        const shown = popover.locator("pre");
        await expect(shown).toHaveText(/^[A-Za-z0-9_-]{20}$/);
        const setBox = (label: string) =>
            popover.locator(":has(> input[type=checkbox])", { hasText: label }).locator("input");
        for (const label of [
            "Uppercase Letters",
            "Lowercase Letters",
            "Digits",
            "Underscore & Dash"
        ]) {
            await setBox(label).uncheck();
        }
        // The last password no longer matches the options: it must not stay on offer
        await expect(shown).toBeHidden();
        await expect(popover.getByRole("status")).toHaveText("Choose at least one character set.");
        await expect(popover.getByRole("button", { name: "Use This" })).toBeDisabled();
        await expect(passwordField).toHaveValue(before);
        // Positive control: a set ticked again gives a password that can be used
        await setBox("Digits").check();
        await expect(shown).toHaveText(/^[0-9]{20}$/);
        await expect(popover.getByRole("button", { name: "Use This" })).toBeEnabled();
        const chosen = await shown.textContent();
        await popover.getByRole("button", { name: "Use This" }).click();
        await expect(popover).toBeHidden();
        await expect(passwordField).toHaveValue(chosen);
    });

    test("makes word passwords from the 8,192-word list", async () => {
        const { window } = launched;
        const words = new Set<string>(
            JSON.parse(
                readFileSync(
                    join(process.cwd(), "node_modules/@buttercup/generator/resources/words.json"),
                    "utf8"
                )
            )
        );
        expect(words.size).toBe(8192);
        await window.locator("button:has([data-icon=key])").first().click();
        const popover = window.locator(".Popover-body");
        const shown = popover.locator("pre");
        // The radio sits in a styled wrapper, not a <label>
        await popover
            .locator(":has(> input[type=radio])", { hasText: "Words" })
            .locator("input[type=radio]")
            .check();
        // The default: 4 words joined by "-"
        await expect(shown).toHaveText(/^[a-z]+(-[a-z]+){3}$/);
        for (let i = 0; i < 5; i += 1) {
            const previous = await shown.textContent();
            await popover.getByRole("button", { name: "Generate" }).click();
            await expect(shown).not.toHaveText(previous);
            const password = await shown.textContent();
            for (const word of password.split("-")) {
                expect(words.has(word)).toBe(true);
            }
        }
    });
});
