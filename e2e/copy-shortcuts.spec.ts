import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * The entries list's copy shortcuts (Ctrl/Cmd+B username, Ctrl/Cmd+C password)
 * keep working one after the other, also after switching to another window
 * and back (#1097: the old copy method dropped the list's focus).
 */
test.describe("copy shortcuts", () => {
    let launched: LaunchedApp;
    let vaultDir: string;
    test.beforeAll(async () => {
        launched = await launchApp();
        vaultDir = mkdtempSync(join(tmpdir(), "buttercup-e2e-vault-"));
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
    test("copy one after the other, also after leaving the window", async () => {
        const { app, window } = launched;
        const clip = () => app.evaluate(({ clipboard }) => clipboard.readText());
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        await window.getByRole("button", { name: "Add Vault" }).click();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await window.getByRole("button", { name: "New Entry" }).click();
        await expect(window.getByPlaceholder("Title")).toBeFocused();
        await window.getByPlaceholder("Title").fill("Bank");
        await window.getByPlaceholder("Username").fill("alice");
        await window.getByPlaceholder("Password", { exact: true }).fill("s3cret");
        await window.getByRole("button", { name: "Save" }).click();
        // A save that's still finishing can drop the selection: retry until it sticks
        await expect(async () => {
            await window.getByText("Bank", { exact: true }).first().click();
            await expect(window.getByRole("button", { name: "Edit" })).toBeVisible({
                timeout: 1000
            });
        }).toPass();
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
});
