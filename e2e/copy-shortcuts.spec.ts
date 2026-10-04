import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { test, expect, type Page } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * The entries list's copy shortcuts (Ctrl/Cmd+B username, Ctrl/Cmd+C password)
 * keep working one after the other, also after switching to another window
 * and back (#1097: the old copy method dropped the list's focus), and on a new
 * entry clicked before its first save finished (its row is rendered again
 * once it has an ID, which dropped the focus).
 */
test.describe("copy shortcuts", () => {
    let launched: LaunchedApp;
    let vaultDir: string;
    const clip = () => launched.app.evaluate(({ clipboard }) => clipboard.readText());
    const addEntry = async (window: Page, title: string, username: string, password: string) => {
        await window.getByRole("button", { name: "New Entry" }).click();
        await expect(window.getByPlaceholder("Title")).toBeFocused();
        await window.getByPlaceholder("Title").fill(title);
        await window.getByPlaceholder("Username").fill(username);
        await window.getByPlaceholder("Password", { exact: true }).fill(password);
        await window.getByRole("button", { name: "Save" }).click();
    };
    test.beforeAll(async () => {
        launched = await launchApp();
        vaultDir = mkdtempSync(join(tmpdir(), "buttercup-e2e-vault-"));
        const { app, window } = launched;
        await app.evaluate(
            ({ dialog }, filePath) => {
                dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as any;
            },
            join(vaultDir, "test.bcup")
        );
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        await window.getByRole("button", { name: "Add Vault" }).click();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await expect(passwordPrompt).toBeHidden();
    });
    test.afterAll(async () => {
        await launched?.close();
        rmSync(vaultDir, { recursive: true, force: true });
    });
    test("copy one after the other, also after leaving the window", async () => {
        const { app, window } = launched;
        await addEntry(window, "Bank", "alice", "s3cret");
        await expect(window.getByText("Vault saved").first()).toBeVisible();
        await window.getByText("Bank", { exact: true }).first().click();
        await window.keyboard.press("Control+b");
        await expect.poll(clip).toBe("alice");
        await window.keyboard.press("Control+c");
        await expect.poll(clip).toBe("s3cret");
        // Leave the window (paste elsewhere) and come back
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].blur());
        await app.evaluate(({ clipboard }) => clipboard.writeText("pasted elsewhere"));
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
        await window.keyboard.press("Control+b");
        await expect.poll(clip).toBe("alice");
        await window.keyboard.press("Control+c");
        await expect.poll(clip).toBe("s3cret");
    });
    test("copy from a new entry clicked before its save finished", async () => {
        const { window } = launched;
        // Hold the vault save back, so the click lands before it finishes
        await launched.app.evaluate(() => {
            const { promises } = process.mainModule.require("fs");
            const rename = promises.rename;
            promises.rename = async (source: string, target: string) => {
                if (target.endsWith(".bcup")) {
                    promises.rename = rename;
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
                return rename(source, target);
            };
        });
        await addEntry(window, "Mail", "bob", "hunter2");
        const unsavedRow = await window.getByText("Mail", { exact: true }).first().elementHandle();
        await unsavedRow.click();
        // Saved: the row is rendered again under the entry's new ID
        await expect.poll(() => unsavedRow.evaluate((el) => el.isConnected)).toBe(false);
        await window.keyboard.press("Control+b");
        await expect.poll(clip).toBe("bob");
        await window.keyboard.press("Control+c");
        await expect.poll(clip).toBe("hunter2");
    });
});
