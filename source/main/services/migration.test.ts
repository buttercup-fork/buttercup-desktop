import { FILE_HOST_KEY_VERSION, runConfigMigrations } from "./migration";
import { Config } from "../types";

function makeConfig(values: Partial<Config>): Config {
    return values as Config;
}

describe("file host key migration", () => {
    test("drops a key from before the version and marks the config", () => {
        const [config, changed] = runConfigMigrations(makeConfig({ fileHostKey: "old-key" }));
        expect(changed).toBe(true);
        expect(config.fileHostKey).toBeNull();
        expect(config.fileHostKeyVersion).toBe(FILE_HOST_KEY_VERSION);
    });

    test("keeps a key once the config has the version", () => {
        const [config, changed] = runConfigMigrations(
            makeConfig({ fileHostKey: "new-key", fileHostKeyVersion: FILE_HOST_KEY_VERSION })
        );
        expect(changed).toBe(false);
        expect(config.fileHostKey).toBe("new-key");
    });

    test("only drops the key once", () => {
        const [first] = runConfigMigrations(makeConfig({ fileHostKey: "old-key" }));
        const generated = { ...first, fileHostKey: "generated-key" };
        const [second, changed] = runConfigMigrations(generated);
        expect(changed).toBe(false);
        expect(second.fileHostKey).toBe("generated-key");
    });

    test("marks a fresh config without touching anything else", () => {
        const [config] = runConfigMigrations(makeConfig({ fileHostKey: null, windowWidth: 800 }));
        expect(config.fileHostKey).toBeNull();
        expect(config.windowWidth).toBe(800);
        expect(config.fileHostKeyVersion).toBe(FILE_HOST_KEY_VERSION);
    });
});
