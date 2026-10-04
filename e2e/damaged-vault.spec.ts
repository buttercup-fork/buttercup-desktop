import { join } from "path";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * A vault file cut off while saving gets a clear message instead of
 * "Failed deriving key: Salt must be provided" (#1233), and can be restored
 * from the copy kept from the last time it was opened or saved.
 */
test.describe("damaged vault file", () => {
    let launched: LaunchedApp;
    let vaultDir: string;
    let vaultPath: string;
    let damagedContent: string;

    test.beforeAll(async () => {
        launched = await launchApp();
        vaultDir = mkdtempSync(join(tmpdir(), "buttercup-e2e-vault-"));
        vaultPath = join(vaultDir, "test.bcup");
        await launched.app.evaluate(({ dialog }, filePath) => {
            dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as any;
            // Record the restore question and answer it with the response set below
            const state = globalThis as any;
            state.__messageBoxes = [];
            state.__messageBoxResponse = 1;
            dialog.showMessageBox = (async (...args: Array<any>) => {
                state.__messageBoxes.push(args[args.length - 1].title);
                return { response: state.__messageBoxResponse, checkboxChecked: false };
            }) as any;
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
        // Opening it once stores the copy (a just-created vault has none yet)
        await vaultTab.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Unlock vault", exact: true }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();
        await vaultTab.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Lock vault", exact: true }).click();
        // Cut the vault file off halfway, as an interrupted save would
        const content = readFileSync(vaultPath, "utf8");
        damagedContent = content.slice(0, Math.floor(content.length / 2));
        writeFileSync(vaultPath, damagedContent);
        await vaultTab.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Unlock vault", exact: true }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await expect(window.getByText(/The vault file is incomplete or damaged/)).toBeVisible();
        await expect(window.getByText(/Salt must be provided/)).toHaveCount(0);
        // The restore was offered and declined
        expect(await launched.app.evaluate(() => (globalThis as any).__messageBoxes)).toEqual([
            "Damaged Vault File"
        ]);
        expect(readFileSync(vaultPath, "utf8")).toBe(damagedContent);
    });

    test("restores the last saved copy", async () => {
        const { app, homeDir, window } = launched;
        const vaultTab = window.getByText("test", { exact: true }).first();
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        await app.evaluate(() => {
            (globalThis as any).__messageBoxResponse = 0;
        });
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();
        // The damaged file was kept in the backup folder before it was replaced
        const backups = readdirSync(homeDir, { recursive: true, encoding: "utf8" }).filter((file) =>
            /damaged_[^\/]*\.bcup$/.test(file)
        );
        expect(backups).toHaveLength(1);
        expect(readFileSync(join(homeDir, backups[0]), "utf8")).toBe(damagedContent);
        // The vault file is whole again: it unlocks without being asked
        await vaultTab.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Lock vault", exact: true }).click();
        await vaultTab.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Unlock vault", exact: true }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();
        expect(await app.evaluate(() => (globalThis as any).__messageBoxes)).toHaveLength(2);
    });
});
