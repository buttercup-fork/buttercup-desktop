import { REMOVED_FILE_HOST_KEYS, runConfigMigrations } from "./migration";
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
