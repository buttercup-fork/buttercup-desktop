import { join } from "path";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * A vault file cut off while saving gets a clear message instead of
 * "Failed deriving key: Salt must be provided" (#1233).
 */
test.describe("damaged vault file", () => {
    let launched: LaunchedApp;
    let vaultDir: string;
    let vaultPath: string;

    test.beforeAll(async () => {
        launched = await launchApp();
        vaultDir = mkdtempSync(join(tmpdir(), "buttercup-e2e-vault-"));
        vaultPath = join(vaultDir, "test.bcup");
        await launched.app.evaluate(({ dialog }, filePath) => {
            dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as any;
        }, vaultPath);
    });

    test.afterAll(async () => {
        await launched?.close();
        rmSync(vaultDir, { recursive: true, force: true });
    });

    test("says the vault file is damaged", async () => {
        const { window } = launched;
        const vaultTab = window.getByText("test", { exact: true }).first();
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        await window.getByRole("button", { name: "Add Vault" }).click();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();
        await vaultTab.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Lock vault", exact: true }).click();
        // Cut the vault file off halfway, as an interrupted save would
        const content = readFileSync(vaultPath, "utf8");
        writeFileSync(vaultPath, content.slice(0, Math.floor(content.length / 2)));
        await vaultTab.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Unlock vault", exact: true }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await expect(window.getByText(/The vault file is incomplete or damaged/)).toBeVisible();
        await expect(window.getByText(/Salt must be provided/)).toHaveCount(0);
    });
});
