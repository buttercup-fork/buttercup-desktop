import { join } from "path";
import { readFileSync } from "fs";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * Closing the window to the notification area right after moving or resizing
 * it doesn't throw "Object has been destroyed" (#688): the window's bounds are
 * saved 750 ms after the last move, by then the window was gone. Closing now
 * saves them right away.
 */
test.describe("closing the window", () => {
    let launched: LaunchedApp;
    test.beforeAll(async () => {
        launched = await launchApp();
    });
    test.afterAll(async () => {
        await launched?.close();
    });
    test("right after moving or resizing it throws no error and keeps the bounds", async () => {
        const { app, homeDir } = launched;
        await app.evaluate(() => {
            const errors: Array<string> = [];
            (globalThis as any).__e2eErrors = errors;
            process.on("unhandledRejection", (err: any) =>
                errors.push(String(err?.message ?? err))
            );
            process.on("uncaughtException", (err: any) => errors.push(String(err?.message ?? err)));
        });
        const bounds = await app.evaluate(({ BrowserWindow }) => {
            const [win] = BrowserWindow.getAllWindows();
            const { x, y, width, height } = win.getBounds();
            win.setBounds({ x: x + 10, y: y + 10, width: width - 10, height: height - 10 });
            const moved = win.getBounds();
            win.close();
            return moved;
        });
        await expect
            .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length))
            .toBe(0);
        // Past the 750 ms the bounds used to be saved after
        await new Promise((resolve) => setTimeout(resolve, 1500));
        expect(await app.evaluate(() => (globalThis as any).__e2eErrors)).toEqual([]);
        const config = JSON.parse(
            readFileSync(join(homeDir, "config", "desktop.config.json"), "utf8")
        );
        expect(config).toMatchObject({
            windowX: bounds.x,
            windowY: bounds.y,
            windowWidth: bounds.width,
            windowHeight: bounds.height
        });
    });
});
