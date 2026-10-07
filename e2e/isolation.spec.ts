import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * The window has no Node access and its own isolated world (B-475): a page that ran
 * attacker-controlled script would find nothing of the system to use. Its way to the
 * main process is the preload bridge, limited to the app's own message channels.
 */
test.describe("window isolation", () => {
    let launched: LaunchedApp;

    test.beforeAll(async () => {
        launched = await launchApp();
    });

    test.afterAll(async () => {
        await launched?.close();
    });

    test("the window's settings", async () => {
        const prefs = await launched.app.evaluate(({ BrowserWindow }) => {
            const [win] = BrowserWindow.getAllWindows();
            return (win.webContents as any).getLastWebPreferences();
        });
        expect(prefs.contextIsolation).toBe(true);
        expect(prefs.nodeIntegration).toBe(false);
        expect(prefs.sandbox).toBe(true);
    });

    test("the page has no Node", async () => {
        const found = await launched.window.evaluate(() => ({
            require: typeof (window as any).require,
            module: typeof (window as any).module,
            process: typeof (window as any).process,
            buffer: typeof (window as any).Buffer
        }));
        expect(found).toEqual({
            require: "undefined",
            module: "undefined",
            process: "undefined",
            buffer: "undefined"
        });
    });

    test("the bridge only passes the app's own channels", async () => {
        const result = await launched.window.evaluate(async () => {
            const ipc = (window as any).buttercupIPC;
            const errors: Array<string> = [];
            for (const call of [
                () => ipc.invoke("ELECTRON_BROWSER_REQUIRE", "fs"),
                () => ipc.send("not-a-channel"),
                () => ipc.on("not-a-channel", () => {})
            ]) {
                try {
                    await call();
                    errors.push("allowed");
                } catch (err) {
                    errors.push(String((err as Error).message));
                }
            }
            // A real channel works
            const locale = await ipc.invoke("get-locale");
            return { errors, locale: typeof locale };
        });
        for (const error of result.errors) {
            expect(error).toContain("unknown channel");
        }
        expect(result.locale).toBe("string");
    });
});
