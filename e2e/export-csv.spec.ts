import { join } from "path";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * The CSV export starts with a UTF-8 BOM, so Excel reads it as UTF-8 and
 * shows accented characters ("Accès" showed as "AccÃ¨s", #749), and the
 * export still imports into another vault.
 */
test.describe("CSV export", () => {
    let launched: LaunchedApp;
    let dir: string;
    test.beforeAll(async () => {
        launched = await launchApp();
        dir = mkdtempSync(join(tmpdir(), "buttercup-e2e-export-"));
        await launched.app.evaluate(({ dialog }) => {
            const g = globalThis as any;
            dialog.showSaveDialog = (async () => ({
                canceled: false,
                filePath: g.__e2eSavePath
            })) as any;
            dialog.showOpenDialog = (async () => ({
                canceled: false,
                filePaths: [g.__e2eOpenPath]
            })) as any;
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
    const clickMenu = (labels: Array<string>) =>
        launched.app.evaluate(({ Menu }, labels) => {
            let items = Menu.getApplicationMenu().items;
            let item: Electron.MenuItem;
            for (const label of labels) {
                item = items.find((candidate) => candidate.label === label);
                items = item.submenu?.items ?? [];
            }
            item.click();
        }, labels);
    const createVault = async (name: string) => {
        const { app, window } = launched;
        await setPaths({ save: join(dir, `${name}.bcup`) });
        // What the app menu's "Add New" does
        await app.evaluate(({ BrowserWindow }) => {
            BrowserWindow.getAllWindows()[0].webContents.send("add-vault");
        });
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await expect(passwordPrompt).toBeHidden();
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();
        // The "Current Vault" menu is rebuilt in the background after a vault
        // change, and its Import/Export act on the vault it was built for
        await expect
            .poll(() =>
                launched.app.evaluate(
                    ({ Menu }) =>
                        Menu.getApplicationMenu().items.find(
                            (item) => item.label === "Current Vault"
                        )?.submenu?.items[0]?.label
                )
            )
            .toBe(name);
    };

    test("starts with a UTF-8 BOM and imports again", async () => {
        const { window } = launched;
        await createVault("accents");
        await window.getByRole("button", { name: "New Entry" }).click();
        await expect(window.getByPlaceholder("Title")).toBeFocused();
        await window.getByPlaceholder("Title").fill("Café crème");
        await window.getByPlaceholder("Username").fill("élodie");
        await window.getByPlaceholder("Password", { exact: true }).fill("s3cret");
        await window.getByRole("button", { name: "Save" }).click();
        await expect(window.getByRole("button", { name: "Edit" })).toBeVisible();

        const exported = join(dir, "export.csv");
        await setPaths({ save: exported });
        await clickMenu(["Current Vault", "Export"]);
        await expect(window.getByText("Successfully exported vault: accents")).toBeVisible();
        await expect.poll(() => existsSync(exported)).toBe(true);
        const bytes = readFileSync(exported);
        expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
        expect(bytes.subarray(3).toString("utf8")).toMatch(/^!type,/);
        expect(bytes.toString("utf8")).toContain("Café crème");

        await createVault("imported");
        await setPaths({ open: exported });
        await clickMenu(["Current Vault", "Import", "Buttercup (CSV)"]);
        await expect(window.getByText("Successfully imported vault: export.csv")).toBeVisible();
        // The imported group sits next to the new vault's own "General"
        const groups = window.getByText("General", { exact: true });
        await expect(groups).toHaveCount(2);
        await groups.nth(1).click();
        await window.getByText("Café crème", { exact: true }).click();
        await expect(window.getByText("élodie", { exact: true }).first()).toBeVisible();
    });
});
