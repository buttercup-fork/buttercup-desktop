import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * The window follows the app's theme setting (nativeTheme.themeSource, set from the
 * preferences in the main process) through the colour-scheme media query.
 */
test.describe("theme", () => {
    let launched: LaunchedApp;

    test.beforeAll(async () => {
        launched = await launchApp();
    });

    test.afterAll(async () => {
        await launched?.close();
    });

    const setThemeSource = (source: "dark" | "light") =>
        launched.app.evaluate(({ nativeTheme }, value) => {
            nativeTheme.themeSource = value;
        }, source);

    test("the window switches between dark and light with the theme setting", async () => {
        const { window } = launched;
        await setThemeSource("dark");
        await expect(window.locator("body.bp4-dark")).toHaveCount(1);
        await setThemeSource("light");
        await expect(window.locator("body.bp4-dark")).toHaveCount(0);
        await setThemeSource("dark");
        await expect(window.locator("body.bp4-dark")).toHaveCount(1);
    });
});
