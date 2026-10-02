import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * #1238: the window must never leave the app's own page (the renderer has Node
 * integration), and only http(s)/mailto links may be handed to the OS.
 * shell.openExternal is stubbed so no browser opens during the test.
 */
test.describe("navigation limits", () => {
    let launched: LaunchedApp;

    // The router may still move between hash routes (e.g. to #/add-vault),
    // so only check that the window is on the app's index.html.
    const APP_PAGE = /^file:.*\/build\/renderer\/index\.html(#.*)?$/;

    const openedExternally = () =>
        launched.app.evaluate(() => (globalThis as any).__openedExternally as string[]);

    test.beforeAll(async () => {
        launched = await launchApp();
        await launched.app.evaluate(({ shell }) => {
            (globalThis as any).__openedExternally = [];
            shell.openExternal = async (url: string) => {
                (globalThis as any).__openedExternally.push(url);
            };
        });
    });

    test.afterAll(async () => {
        await launched?.close();
    });

    test("keeps hash routing inside the app", async () => {
        const { window } = launched;
        await window.evaluate(() => {
            window.location.hash = "#/";
        });
        expect(window.url()).toMatch(APP_PAGE);
    });

    test("blocks navigating the window to a web page", async () => {
        const { window } = launched;
        await window.evaluate(() => {
            window.location.href = "https://example.com/";
        });
        await window.waitForTimeout(1_000);
        expect(window.url()).toMatch(APP_PAGE);
        expect(await openedExternally()).toContain("https://example.com/");
    });

    test("blocks navigating the window to a local file", async () => {
        const { window } = launched;
        await window.evaluate(() => {
            window.location.href = "file:///C:/Windows/win.ini";
        });
        await window.waitForTimeout(1_000);
        expect(window.url()).toMatch(APP_PAGE);
        expect(await openedExternally()).not.toContain("file:///C:/Windows/win.ini");
    });

    test("never opens new windows, and only passes safe links to the OS", async () => {
        const { app, window } = launched;
        await window.evaluate(() => {
            window.open("https://github.com/login", "_blank");
            window.open("file:///C:/Windows/System32/calc.exe", "_blank");
            window.open("smb://attacker.example/share/run.exe", "_blank");
        });
        await window.waitForTimeout(1_000);
        expect(app.windows()).toHaveLength(1);
        const opened = await openedExternally();
        expect(opened).toContain("https://github.com/login");
        expect(opened.some((url) => !/^https?:/.test(url))).toBe(false);
    });
});
