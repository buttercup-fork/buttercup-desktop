import { spawn } from "child_process";
import { join } from "path";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

const PROJECT_ROOT = join(__dirname, "..");

/**
 * A second Buttercup process (a click on a codekunde-buttercup:// link, or a second
 * start from the launcher) is refused the single-instance lock. It has to quit
 * without booting, or initialise() would run next to the first instance's.
 */
test.describe("second instance", () => {
    let launched: LaunchedApp;

    test.beforeAll(async () => {
        launched = await launchApp();
    });

    test.afterAll(async () => {
        await launched?.close();
    });

    test("quits without booting and leaves the first instance running", async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const electronPath: string = require("electron");
        const child = spawn(
            electronPath,
            [
                PROJECT_ROOT,
                `--user-data-dir=${join(launched.homeDir, "electron")}`,
                ...(process.env.CI || process.env.BUTTERCUP_E2E_HEADLESS
                    ? [
                          "--no-sandbox",
                          "--disable-gpu",
                          "--disable-software-rasterizer",
                          "--disable-dev-shm-usage"
                      ]
                    : [])
            ],
            {
                env: {
                    ...process.env,
                    BUTTERCUP_HOME_DIR: launched.homeDir,
                    NODE_ENV: "test",
                    BUTTERCUP_E2E: "1"
                }
            }
        );
        let output = "";
        for (const stream of [child.stdout, child.stderr]) {
            stream.on("data", (chunk) => {
                output += chunk.toString();
            });
        }
        const exitCode = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => {
                child.kill();
                resolve(null);
            }, 30000);
            child.on("exit", (code) => {
                clearTimeout(timer);
                resolve(code);
            });
        });
        expect(exitCode, `the second instance didn't quit. Output:\n${output}`).toBe(0);
        expect(output).not.toContain("Application ready");
        // The first instance is still there and working
        expect(await launched.window.title()).toBeTruthy();
    });
});
