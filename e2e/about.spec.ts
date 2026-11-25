import { join } from "path";
import { readFileSync } from "fs";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

const ROOT = join(__dirname, "..");
const APP_VERSION: string = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const CORE_VERSION: string = JSON.parse(
    readFileSync(join(ROOT, "node_modules/buttercup/package.json"), "utf8")
).version;
const REPO = "https://github.com/buttercup-fork/buttercup-desktop";
const PLATFORMS: Record<string, string> = { win32: "Windows", darwin: "macOS", linux: "Linux" };

/**
 * The About dialog (B-810): version, maintainer, update status, core and platform,
 * the project's links (opened through the main process by name, never by address)
 * and a plain-text copy of the details for a bug report.
 */
test.describe("About dialog", () => {
    let launched: LaunchedApp;

    const openedExternally = () =>
        launched.app.evaluate(() => (globalThis as any).__openedExternally as string[]);

    const openAbout = async () => {
        await launched.app.evaluate(({ BrowserWindow }) => {
            BrowserWindow.getAllWindows()[0].webContents.send("open-about");
        });
        const dialog = launched.window.getByRole("dialog", { name: "About Buttercup" });
        await expect(dialog).toBeVisible();
        return dialog;
    };

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

    test("shows the version, maintainer, core, platform and update status", async () => {
        const dialog = await openAbout();
        await expect(dialog.getByRole("heading", { name: "Buttercup" })).toBeVisible();
        await expect(dialog).toContainText(`Version ${APP_VERSION} · Maintained by CodeKunde`);
        await expect(dialog.getByTestId("about-core")).toHaveText(CORE_VERSION);
        await expect(dialog.getByTestId("about-platform")).toHaveText(
            `${PLATFORMS[process.platform] ?? process.platform} ${process.arch}, installed`
        );
        // An unpackaged build has no release feed, so it never checks
        await expect(dialog.getByRole("status")).toHaveText("Not checked for updates yet");
        // The runtime versions are only in the copied details
        await expect(dialog).not.toContainText("Electron");
    });

    test("opens each project link by name", async () => {
        const dialog = await openAbout();
        for (const name of [
            "Website",
            "Release notes",
            "Report a problem",
            "Report a security issue",
            "GPL-3.0 licence"
        ]) {
            await dialog.getByRole("link", { name }).click();
        }
        await expect
            .poll(openedExternally)
            .toEqual([
                "https://buttercup.codekunde.net",
                `${REPO}/releases`,
                `${REPO}/issues`,
                `${REPO}/security/policy`,
                `${REPO}/blob/master/LICENSE`
            ]);
    });

    test("copies the details as plain text and says so", async () => {
        const dialog = await openAbout();
        await launched.app.evaluate(({ clipboard }) => clipboard.writeText("before"));
        await dialog.getByRole("button", { name: "Copy details" }).click();
        await expect(dialog.getByRole("button", { name: "Copied" })).toBeVisible();
        const text = await launched.app.evaluate(({ clipboard }) => clipboard.readText());
        const lines = text.split("\n");
        expect(lines[0]).toBe(`Buttercup ${APP_VERSION} (installed)`);
        expect(lines[1]).toBe(`Core ${CORE_VERSION}`);
        expect(lines[2]).toMatch(
            /^Electron \d+\.\d+\.\d+, Chromium [\d.]+, Node\.js \d+\.\d+\.\d+$/
        );
        expect(lines[3]).toBe(`${PLATFORMS[process.platform] ?? process.platform} ${process.arch}`);
        await expect(dialog.getByRole("button", { name: "Copy details" })).toBeVisible({
            timeout: 5000
        });
    });

    // Blueprint's teal: TURQUOISE2 on the light dialog, TURQUOISE4 on the dark one
    const LINK_COLOURS = { light: "rgb(0, 112, 103)", dark: "rgb(19, 201, 186)" };

    for (const theme of ["dark", "light"] as const) {
        test(`fits its labels and keeps its colours in the ${theme} theme`, async () => {
            await launched.app.evaluate(({ nativeTheme }, value) => {
                nativeTheme.themeSource = value;
            }, theme);
            await expect(launched.window.locator("body.bp4-dark")).toHaveCount(
                theme === "dark" ? 1 : 0
            );
            const dialog = await openAbout();
            // No label is cut off (the longest is "Report a security issue")
            const clipped = await dialog.evaluate((root) =>
                [...root.querySelectorAll("a, button, h3, p")]
                    .filter((el) => el.scrollWidth > el.clientWidth + 1)
                    .map((el) => el.textContent)
            );
            expect(clipped).toEqual([]);
            // The tiles use the text colour and the licence link the app's teal, not
            // Blueprint's link blue
            const colours = await dialog.evaluate((root) => ({
                text: getComputedStyle(root).color,
                tile: getComputedStyle(
                    [...root.querySelectorAll("a")].find((a) => a.textContent === "Website")
                ).color,
                licence: getComputedStyle(
                    [...root.querySelectorAll("a")].find((a) => a.textContent === "GPL-3.0 licence")
                ).color
            }));
            expect(colours.tile).toBe(colours.text);
            expect(colours.licence).toBe(LINK_COLOURS[theme]);
        });
    }

    test("closes", async () => {
        const dialog = await openAbout();
        await dialog.getByRole("button", { name: "Close" }).click();
        await expect(dialog).toBeHidden();
    });
});
