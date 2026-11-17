import { join } from "path";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * Browsers paired by an earlier version are forgotten at the first start (B-800):
 * earlier versions share the settings folder, and their browser connection could be
 * paired from the network or a web page, so such a pairing must not carry over.
 */
test.describe("browser pairings from an earlier version", () => {
    let launched: LaunchedApp;
    test.beforeAll(async () => {
        launched = await launchApp({
            prepare: (homeDir) => {
                // A settings file as an earlier version left it: one paired browser
                mkdirSync(join(homeDir, "config"), { recursive: true });
                writeFileSync(
                    join(homeDir, "config", "desktop.config.json"),
                    JSON.stringify({
                        browserClients: { "client-from-2x": { publicKey: "old-public-key" } },
                        windowWidth: 900
                    })
                );
            }
        });
    });
    test.afterAll(async () => {
        await launched?.close();
    });
    test("are forgotten at the first start, the other settings stay", async () => {
        const readConfig = () =>
            JSON.parse(
                readFileSync(join(launched.homeDir, "config", "desktop.config.json"), "utf8")
            );
        await expect.poll(() => readConfig().browserPairingsReset).toBe(1);
        const config = readConfig();
        expect(config.browserClients).toEqual({});
        expect(config.windowWidth).toBe(900);
    });
});
