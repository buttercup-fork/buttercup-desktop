import { join } from "path";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

const PASSWORD = "pass";

async function readEntryTitles(vaultPath: string): Promise<Array<string>> {
    const { Credentials, FileDatasource, Vault, init } = await import("buttercup");
    init();
    const datasource = new FileDatasource(
        Credentials.fromDatasource({ path: vaultPath }, PASSWORD)
    );
    const { Format, history } = await datasource.load(Credentials.fromPassword(PASSWORD));
    const vault = Vault.createFromHistory(history, Format);
    return vault.getAllEntries().map((entry) => entry.getProperty("title") as string);
}

/**
 * A failed save leaves changes only in memory (#1230): locking or quitting
 * by hand asks first, and "Save and …" retries the save.
 */
test.describe("unsaved changes", () => {
    let launched: LaunchedApp;
    let vaultDir: string;
    let vaultPath: string;

    test.beforeAll(async () => {
        launched = await launchApp();
        vaultDir = mkdtempSync(join(tmpdir(), "buttercup-e2e-vault-"));
        vaultPath = join(vaultDir, "test.bcup");
        await launched.app.evaluate(({ dialog }, filePath) => {
            dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as any;
            // Record message boxes and answer them from a queue of button indexes
            const g = globalThis as any;
            g.__messageBoxes = [];
            g.__messageBoxAnswers = [];
            dialog.showMessageBox = (async (...args: Array<any>) => {
                const options = args[args.length - 1];
                g.__messageBoxes.push({ message: options.message, buttons: options.buttons });
                return { response: g.__messageBoxAnswers.shift() ?? 0, checkboxChecked: false };
            }) as any;
        }, vaultPath);
    });

    test.afterAll(async () => {
        await launched?.close().catch(() => {});
        rmSync(vaultDir, { recursive: true, force: true });
    });

    test("asks before locking or quitting with unsaved changes", async () => {
        const { app, window } = launched;
        const answer = (...responses: Array<number>) =>
            app.evaluate((_, r) => (globalThis as any).__messageBoxAnswers.push(...r), responses);
        const messageBoxes = () =>
            app.evaluate(() => (globalThis as any).__messageBoxes.slice()) as Promise<
                Array<{ message: string; buttons: Array<string> }>
            >;
        const clearMessageBoxes = () =>
            app.evaluate(() => ((globalThis as any).__messageBoxes = []));
        const vaultTab = window.getByText("test", { exact: true }).first();
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        const lockVault = async () => {
            await vaultTab.click({ button: "right" });
            await window.getByRole("menuitem", { name: "Lock vault", exact: true }).click();
        };
        // New vault, then make its file read-only so saves fail
        await window.getByRole("button", { name: "Add Vault" }).click();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        await passwordPrompt.fill(PASSWORD);
        await passwordPrompt.press("Enter");
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();
        // Swap the vault file for a folder so saves fail (a read-only file
        // doesn't stop CI, which runs as root)
        const vaultFile = readFileSync(vaultPath);
        rmSync(vaultPath);
        mkdirSync(vaultPath);
        await window.getByRole("button", { name: "New Entry" }).click();
        await window.getByPlaceholder("Title").fill("Kept entry");
        await window.getByRole("button", { name: "Save" }).click();
        await expect(window.getByText(/Vault failed to save/)).toBeVisible();
        // Locking asks; Cancel keeps it unlocked
        await answer(2);
        await lockVault();
        await expect.poll(messageBoxes).toEqual([
            {
                message: "Lock with unsaved changes?",
                buttons: ["Save and Lock", "Lock Anyway", "Cancel"]
            }
        ]);
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();
        await clearMessageBoxes();
        // Quitting asks too; a save that still fails keeps the app open
        await answer(0);
        await app.evaluate(({ app }) => app.quit());
        await expect
            .poll(async () => (await messageBoxes()).map((box) => box.message))
            .toEqual([
                "Quit with unsaved changes?",
                "Saving failed, so Buttercup stays open. Check the vault's connection or file and try again."
            ]);
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();
        // Once the file is back, "Save and Quit" saves and quits
        rmSync(vaultPath, { recursive: true });
        writeFileSync(vaultPath, vaultFile);
        expect(await readEntryTitles(vaultPath)).toEqual([]);
        await answer(0);
        const closed = app.waitForEvent("close");
        await app.evaluate(({ app }) => app.quit());
        await closed;
        expect(await readEntryTitles(vaultPath)).toEqual(["Kept entry"]);
    });
});
