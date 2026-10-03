import { execFileSync } from "child_process";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";

function readRunEntries(): string {
    try {
        return execFileSync("reg", ["query", RUN_KEY], { encoding: "utf8" });
    } catch {
        return "";
    }
}

/**
 * Turning "Start with session" off removes the Windows login item again
 * (#1267). Uses the real registry (HKCU Run) of the machine running the test.
 */
test.describe("start with session (Windows)", () => {
    test.skip(process.platform !== "win32", "Windows login items only");

    let launched: LaunchedApp;
    let execPath: string;

    test.beforeAll(async () => {
        launched = await launchApp();
        execPath = await launched.app.evaluate(() => process.execPath);
    });

    test.afterAll(async () => {
        // Never leave a login item behind, even if the test failed
        await launched?.app
            .evaluate(({ app }, path) => {
                app.setLoginItemSettings({ openAtLogin: false, path, args: ["--autostart"] });
            }, execPath)
            .catch(() => {});
        await launched?.close();
    });

    test("adds and removes the login item", async () => {
        const { window } = launched;
        const setStartWithSession = (enabled: boolean) =>
            window.evaluate(async (startWithSession) => {
                const { ipcRenderer } = require("electron");
                const preferences = await new Promise<any>((resolve) => {
                    ipcRenderer.once("get-preferences:reply", (_, payload) =>
                        resolve(JSON.parse(payload))
                    );
                    ipcRenderer.send("get-preferences");
                });
                ipcRenderer.send(
                    "write-preferences",
                    JSON.stringify({ preferences: { ...preferences, startWithSession } })
                );
            }, enabled);
        const isRegistered = () =>
            readRunEntries()
                .split(/\r?\n/)
                .some((line) => line.includes(execPath) && line.includes("--autostart"));
        expect(isRegistered()).toBe(false);
        await setStartWithSession(true);
        await expect.poll(isRegistered).toBe(true);
        await setStartWithSession(false);
        await expect.poll(isRegistered).toBe(false);
    });
});
