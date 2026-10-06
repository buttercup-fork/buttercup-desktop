import { join } from "path";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import {
    test,
    expect,
    _electron as electron,
    type ElectronApplication,
    type Page
} from "@playwright/test";

const PROJECT_ROOT = join(__dirname, "..");

/**
 * The same vault file can't be added twice (#1172): it showed up in two tabs,
 * and creating a "new" vault over one already in the list replaced its file.
 * Vaults added before this get their location key once unlocked.
 */
test.describe("adding a vault twice", () => {
    let root: string;
    let homeDir: string;
    let vaultPath: string;
    let app: ElectronApplication;
    let window: Page;
    // The app's console output (its log lines, unhandled errors) for the report
    let output = "";

    const launch = async () => {
        app = await electron.launch({
            args: [
                PROJECT_ROOT,
                `--user-data-dir=${join(homeDir, "electron")}`,
                ...(process.env.CI || process.env.BUTTERCUP_E2E_HEADLESS
                    ? [
                          "--no-sandbox",
                          "--disable-gpu",
                          "--disable-software-rasterizer",
                          "--disable-dev-shm-usage"
                      ]
                    : [])
            ],
            env: {
                ...process.env,
                BUTTERCUP_HOME_DIR: homeDir,
                NODE_ENV: "test",
                BUTTERCUP_E2E: "1"
            }
        });
        output = "";
        for (const stream of [app.process().stdout, app.process().stderr]) {
            stream?.on("data", (chunk) => {
                output += chunk.toString();
            });
        }
        window = await app.firstWindow();
        await window.waitForLoadState("domcontentloaded");
        await app.evaluate(({ dialog }, filePath) => {
            dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as any;
            dialog.showOpenDialog = (async () => ({
                canceled: false,
                filePaths: [filePath]
            })) as any;
        }, vaultPath);
    };

    const addVault = async (button: "Create New" | "Load Existing") => {
        // What the app menu's "Add New" does
        await app.evaluate(({ BrowserWindow }) => {
            BrowserWindow.getAllWindows()[0].webContents.send("add-vault");
        });
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: button }).click();
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
    };

    test.beforeAll(() => {
        root = mkdtempSync(join(tmpdir(), "buttercup-e2e-duplicate-"));
        homeDir = join(root, "home");
        vaultPath = join(root, "test.bcup");
    });

    // A failure of the location-key test happened once and couldn't be
    // reproduced (B-457): keep the app's output and the vault list with the report
    test.afterEach(async ({}, testInfo) => {
        if (testInfo.status === testInfo.expectedStatus) return;
        // As a file, so it lands in test-results (which CI uploads)
        const outputFile = testInfo.outputPath("app-output.txt");
        writeFileSync(outputFile, output);
        await testInfo.attach("app-output.txt", { path: outputFile });
        const vaultsJSON = join(homeDir, "data", "vaults.json");
        if (existsSync(vaultsJSON)) await testInfo.attach("vaults.json", { path: vaultsJSON });
    });

    test.afterAll(async () => {
        await app?.close().catch(() => {});
        rmSync(root, { recursive: true, force: true });
    });

    test("refuses the same vault file again", async () => {
        await launch();
        await addVault("Create New");
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();
        const vaultFile = readFileSync(vaultPath, "utf8");
        // Creating a new vault on the same file
        await addVault("Create New");
        await expect(
            window.getByText(/This vault is already in Buttercup as "test"/)
        ).toBeVisible();
        expect(readFileSync(vaultPath, "utf8")).toBe(vaultFile);
        await app.close();
    });

    test("recognises a vault added before location keys", async () => {
        // Remove the key, as for a vault added by an earlier version
        const vaultsJSON = join(homeDir, "data", "vaults.json");
        const stored = readFileSync(vaultsJSON, "utf8");
        expect(stored).toMatch(/locationKey/);
        writeFileSync(vaultsJSON, stored.replace(/\\"locationKey\\":\\"[0-9a-f]+\\"/g, ""));
        await launch();
        // Unlocking stores the key again
        const vaultTab = window.getByText("test", { exact: true }).first();
        await vaultTab.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Unlock vault", exact: true }).click();
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await expect(window.getByRole("button", { name: "New Entry" })).toBeVisible();
        await expect.poll(() => readFileSync(vaultsJSON, "utf8")).toMatch(/locationKey/);
        await addVault("Load Existing");
        await expect(
            window.getByText(/This vault is already in Buttercup as "test"/)
        ).toBeVisible();
    });
});
