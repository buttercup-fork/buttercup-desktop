import { join } from "path";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * Load Existing offers "All Files" next to the Buttercup filter, so a vault
 * file with another extension, or none, can be added (#1371). A file that
 * isn't a vault is turned away with a clear message instead of "Failed
 * unlocking source: No valid signature in vault".
 */
test.describe("vault files with any extension", () => {
    let launched: LaunchedApp;
    let dir: string;
    test.beforeAll(async () => {
        launched = await launchApp();
        dir = mkdtempSync(join(tmpdir(), "buttercup-e2e-vault-"));
        await launched.app.evaluate(({ dialog }) => {
            const g = globalThis as any;
            g.__e2eOpenDialogs = [];
            g.__e2eMessages = [];
            dialog.showSaveDialog = (async () => ({
                canceled: false,
                filePath: g.__e2eSavePath
            })) as any;
            dialog.showOpenDialog = (async (...args: Array<any>) => {
                g.__e2eOpenDialogs.push(args[args.length - 1]);
                return { canceled: false, filePaths: [g.__e2eOpenPath] };
            }) as any;
            dialog.showMessageBox = (async (...args: Array<any>) => {
                g.__e2eMessages.push(args[args.length - 1].message);
                return { response: 0 };
            }) as any;
        });
    });
    test.afterAll(async () => {
        await launched?.close();
        rmSync(dir, { recursive: true, force: true });
    });
    const setPaths = (paths: { save?: string; open?: string }) =>
        launched.app.evaluate((_electron, { save, open }) => {
            const g = globalThis as any;
            g.__e2eSavePath = save;
            g.__e2eOpenPath = open;
        }, paths);
    // What the app menu's "Add New" does: the Add Vault button is gone once a vault is open
    const openAddVault = () =>
        launched.app.evaluate(({ BrowserWindow }) => {
            BrowserWindow.getAllWindows()[0].webContents.send("add-vault");
        });

    test("adds a vault file without an extension", async () => {
        const { app, window } = launched;
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        // Make a vault, then a copy of it without the extension
        await setPaths({ save: join(dir, "original.bcup") });
        await openAddVault();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();
        copyFileSync(join(dir, "original.bcup"), join(dir, "my-vault"));

        await setPaths({ open: join(dir, "my-vault") });
        await openAddVault();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Load Existing" }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await expect(window.getByText("my-vault", { exact: true }).first()).toBeVisible();
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();

        const [options] = await app.evaluate(() => (globalThis as any).__e2eOpenDialogs);
        expect(options.filters).toEqual([
            { name: "Buttercup Vaults", extensions: ["bcup"] },
            { name: "All Files", extensions: ["*"] }
        ]);
    });

    test("turns away a file that isn't a vault", async () => {
        const { app, window } = launched;
        const notes = join(dir, "notes & plans.txt");
        writeFileSync(notes, "just some notes\n");
        await setPaths({ open: notes });
        await openAddVault();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Load Existing" }).click();
        await expect
            .poll(() => app.evaluate(() => (globalThis as any).__e2eMessages))
            .toEqual(["\"notes & plans.txt\" isn't a Buttercup vault file, so it can't be added."]);
        await expect(window.getByPlaceholder("Vault password...")).toHaveCount(0);
        await expect(window.getByText(/No valid signature/)).toHaveCount(0);
        await expect(window.getByText("notes & plans", { exact: true })).toHaveCount(0);
    });
});
