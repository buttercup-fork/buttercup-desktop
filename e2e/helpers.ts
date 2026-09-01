import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";

const PROJECT_ROOT = join(__dirname, "..");

export interface LaunchedApp {
    app: ElectronApplication;
    /** The first application window (the vault window). */
    window: Page;
    /** Call in test teardown. Closes the app and removes its temp data. */
    close: () => Promise<void>;
}

/**
 * Launches the built Electron app in full isolation:
 *
 *  - `BUTTERCUP_HOME_DIR` etc. point Buttercup's config / vault list / logs at a
 *    throwaway folder, so tests never read or write your real Buttercup data.
 *  - `--user-data-dir` isolates Electron's own storage and the single-instance
 *    lock, so tests can run while your personal Buttercup is open.
 *
 * Requires `npm run build` to have been run first (the `test:e2e` script does
 * this for you).
 */
export async function launchApp(): Promise<LaunchedApp> {
    const sandboxDir = mkdtempSync(join(tmpdir(), "buttercup-e2e-"));
    const userDataDir = join(sandboxDir, "electron");

    // Extra flags that make Electron reliable in headless / CI / VM environments
    // where there is no real GPU. Harmless on a normal desktop.
    const headlessFlags =
        process.env.CI || process.env.BUTTERCUP_E2E_HEADLESS
            ? [
                  "--no-sandbox",
                  "--disable-gpu",
                  "--disable-software-rasterizer",
                  "--disable-dev-shm-usage"
              ]
            : [];

    const app = await electron.launch({
        args: [PROJECT_ROOT, `--user-data-dir=${userDataDir}`, ...headlessFlags],
        env: {
            ...process.env,
            // Redirect every Buttercup storage location into the sandbox
            // (storage.ts derives config/data/temp/log subfolders from this).
            BUTTERCUP_HOME_DIR: sandboxDir,
            // Don't check for updates / register protocol handlers during tests.
            NODE_ENV: "test",
            BUTTERCUP_E2E: "1"
        }
    });

    const window = await app.firstWindow();
    await window.waitForLoadState("domcontentloaded");

    return {
        app,
        window,
        close: async () => {
            await app.close();
            rmSync(sandboxDir, { recursive: true, force: true });
        }
    };
}
