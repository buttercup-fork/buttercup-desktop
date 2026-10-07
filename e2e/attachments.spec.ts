import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * Files dropped on an entry become its attachments. The window has no Node access
 * (B-475): the file is read in the page and passed to the main process as bytes.
 */
test.describe("attachments", () => {
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

    test("a dropped file is added to the entry", async () => {
        const { window } = launched;
        await window.getByRole("button", { name: "New Entry" }).click();
        await expect(window.getByPlaceholder("Title")).toBeFocused();
        await window.getByPlaceholder("Title").fill("With file");
        await window.getByRole("button", { name: "Save" }).click();

        const zone = window.getByText("Drag and drop to add attachments");
        await expect(zone).toBeVisible();
        // A new entry has no id until the saved vault comes back, and a file dropped
        // before that has no entry to belong to: drop again until it takes
        await expect(async () => {
            const data = await window.evaluateHandle(() => {
                const transfer = new DataTransfer();
                transfer.items.add(
                    new File(["hello attachment"], "hello.txt", { type: "text/plain" })
                );
                return transfer;
            });
            await zone.dispatchEvent("dragenter", { dataTransfer: data });
            await zone.dispatchEvent("dragover", { dataTransfer: data });
            await zone.dispatchEvent("drop", { dataTransfer: data });
            await expect(window.getByText("hello.txt")).toBeVisible({ timeout: 2500 });
        }).toPass({ timeout: 20000 });
    });
});
