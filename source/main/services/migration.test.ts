import {
    BROWSER_PAIRINGS_RESET_KEY,
    REMOVED_FILE_HOST_KEYS,
    runConfigMigrations
} from "./migration";
import { Config } from "../types";

function makeConfig(values: Record<string, unknown>): Config {
    return values as unknown as Config;
}

describe("file host removal migration", () => {
    test("removes the stored file host key and its version marker", () => {
        const [config, changed] = runConfigMigrations(
            makeConfig({ fileHostKey: "old-key", fileHostKeyVersion: 2, windowWidth: 800 })
        );
        expect(changed).toBe(true);
        for (const key of REMOVED_FILE_HOST_KEYS) {
            expect(Object.prototype.hasOwnProperty.call(config, key)).toBe(false);
        }
        expect(config.windowWidth).toBe(800);
    });

    test("removes a key from before the version marker existed", () => {
        const [config, changed] = runConfigMigrations(makeConfig({ fileHostKey: "old-key" }));
        expect(changed).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(config, "fileHostKey")).toBe(false);
    });

    test("removes an empty key too", () => {
        const [config, changed] = runConfigMigrations(makeConfig({ fileHostKey: null }));
        expect(changed).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(config, "fileHostKey")).toBe(false);
    });

    test("changes nothing once the keys are gone", () => {
        const [first] = runConfigMigrations(makeConfig({ fileHostKey: "old-key" }));
        const [second, changed] = runConfigMigrations(first);
        expect(changed).toBe(false);
        expect(second).toEqual(first);
    });

    test("leaves the browser access preference alone", () => {
        const [config] = runConfigMigrations(
            makeConfig({ fileHostKey: "old-key", preferences: { fileHostEnabled: true } })
        );
        expect(config.preferences.fileHostEnabled).toBe(true);
    });
});

describe("browser pairings reset migration (B-800)", () => {
    const PAIRED = { "client-from-2x": { publicKey: "old-public-key" } };

    test("forgets browsers paired by an earlier version", () => {
        const [config, changed] = runConfigMigrations(
            makeConfig({
                browserClients: PAIRED,
                browserPrivateKey: "desktop-private",
                browserPublicKey: "desktop-public",
                preferences: { fileHostEnabled: true }
            })
        );
        expect(changed).toBe(true);
        expect(config.browserClients).toEqual({});
        expect(config[BROWSER_PAIRINGS_RESET_KEY]).toBe(1);
        // Only the pairings go: the desktop's own keys and the setting stay
        expect(config.browserPrivateKey).toBe("desktop-private");
        expect(config.browserPublicKey).toBe("desktop-public");
        expect(config.preferences.fileHostEnabled).toBe(true);
    });

    test("runs only once: a browser paired after the reset stays paired", () => {
        const [first] = runConfigMigrations(makeConfig({ browserClients: PAIRED }));
        const pairedAgain = {
            ...first,
            browserClients: { "client-from-3x": { publicKey: "new-public-key" } }
        };
        const [second, changed] = runConfigMigrations(pairedAgain);
        expect(changed).toBe(false);
        expect(second.browserClients).toEqual(pairedAgain.browserClients);
    });

    test("marks a new install, so its first pairing is kept", () => {
        const [config, changed] = runConfigMigrations(makeConfig({}));
        expect(changed).toBe(true);
        expect(config.browserClients).toEqual({});
        expect(config[BROWSER_PAIRINGS_RESET_KEY]).toBe(1);
    });
});
