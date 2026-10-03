import { join } from "path";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync
} from "fs";
import { tmpdir } from "os";
import { test, expect, _electron as electron, type ElectronApplication } from "@playwright/test";

const PROJECT_ROOT = join(__dirname, "..");

/**
 * The portable Windows app keeps all its data in a folder next to the exe
 * (#1254), and picks up the vault list and settings from the default location
 * on its first start.
 */
test.describe("portable mode", () => {
    let root: string;
    let exeDir: string;
    let oldAppData: string;
    let app: ElectronApplication;

    test.beforeAll(async () => {
        root = mkdtempSync(join(tmpdir(), "buttercup-e2e-portable-"));
        exeDir = join(root, "usb-stick");
        oldAppData = join(root, "appdata");
        mkdirSync(exeDir, { recursive: true });
        // Stand-in for the user's AppData / XDG folders with an earlier
        // version's vault list ("Buttercup-nodejs" on Windows)
        for (const dir of [
            join(oldAppData, "Buttercup-nodejs", "Data"),
            join(oldAppData, "Buttercup-nodejs")
        ]) {
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, "vaults.json"), "{}");
        }
        mkdirSync(join(oldAppData, "Buttercup-nodejs", "Config"), { recursive: true });
        const env = { ...process.env };
        delete env.BUTTERCUP_HOME_DIR;
        app = await electron.launch({
            args: [
                PROJECT_ROOT,
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
                ...env,
                NODE_ENV: "test",
                BUTTERCUP_E2E: "1",
                // What the portable exe's launcher sets
                PORTABLE_EXECUTABLE_APP_FILENAME: "Buttercup",
                PORTABLE_EXECUTABLE_DIR: exeDir,
                // Keep env-paths' default locations inside the test folder
                APPDATA: oldAppData,
                LOCALAPPDATA: oldAppData,
                XDG_CONFIG_HOME: oldAppData,
                XDG_DATA_HOME: oldAppData,
                XDG_CACHE_HOME: oldAppData,
                XDG_STATE_HOME: oldAppData
            }
        });
        const window = await app.firstWindow();
        await window.waitForLoadState("domcontentloaded");
    });

    test.afterAll(async () => {
        await app?.close();
        rmSync(root, { recursive: true, force: true });
    });

    test("keeps its data next to the exe", async () => {
        const dataDir = join(exeDir, "Buttercup-data");
        expect(await app.evaluate(({ app }) => app.getPath("userData"))).toBe(
            join(dataDir, "electron")
        );
        await expect
            .poll(() => existsSync(join(dataDir, "config", "desktop.config.json")))
            .toBe(true);
        expect(existsSync(join(dataDir, "data", "vaults.json"))).toBe(true);
        const log = join(dataDir, "log", "buttercup-desktop.log");
        await expect.poll(() => existsSync(log)).toBe(true);
        await expect
            .poll(() => readFileSync(log, "utf8"))
            .toContain("Copied the vault list and settings into the portable data folder");
        // Nothing but Buttercup-data next to the exe, and no new log in the old location
        expect(readdirSync(exeDir)).toEqual(["Buttercup-data"]);
        const oldFiles = readdirSync(oldAppData, { recursive: true } as any) as Array<string>;
        expect(oldFiles.filter((file) => file.endsWith(".log"))).toEqual([]);
    });
});
