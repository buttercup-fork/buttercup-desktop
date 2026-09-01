import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * The most basic check: the app starts, opens a window, and renders the React
 * app into #root. If this fails, something is broken at the Electron / bundle
 * level (a good first thing to run after upgrading Electron or webpack).
 */
test.describe("app startup", () => {
    let launched: LaunchedApp;

    test.beforeAll(async () => {
        launched = await launchApp();
    });

    test.afterAll(async () => {
        await launched?.close();
    });

    test("opens a single window titled 'Buttercup'", async () => {
        const { app, window } = launched;
        expect(app.windows()).toHaveLength(1);
        await expect(window).toHaveTitle(/buttercup/i);
    });

    test("mounts the React root", async () => {
        const root = launched.window.locator("#root");
        await expect(root).toBeAttached();
        // Something got rendered into the root element.
        await expect(root).not.toBeEmpty();
    });

    test("has no uncaught errors in the renderer console", async () => {
        const { window } = launched;
        const errors: string[] = [];
        window.on("pageerror", (err) => errors.push(err.message));
        // Give the UI a moment to settle.
        await window.waitForTimeout(1_000);
        expect(errors).toEqual([]);
    });
});
