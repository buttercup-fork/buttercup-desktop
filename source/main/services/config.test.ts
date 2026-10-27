import { jest } from "@jest/globals";

const mockUnlink = jest.fn<(path: string) => Promise<void>>();
const mockLogErr = jest.fn();
const mockGetConfigStorage = jest.fn<() => unknown>();
const mockRunConfigMigrations =
    jest.fn<(config: Record<string, unknown>) => [Record<string, unknown>, boolean]>();

jest.unstable_mockModule("fs/promises", () => ({ default: { unlink: mockUnlink } }));
jest.unstable_mockModule("./storage", () => ({
    getConfigStorage: mockGetConfigStorage,
    getVaultSettingsPath: (sourceID: string) => `/settings/vault-config-${sourceID}.json`,
    getVaultSettingsStorage: jest.fn()
}));
jest.unstable_mockModule("./migration", () => ({ runConfigMigrations: mockRunConfigMigrations }));
jest.unstable_mockModule("../library/log", () => ({ logErr: mockLogErr, logInfo: jest.fn() }));

let removeVaultSettings: typeof import("./config").removeVaultSettings;
let initialise: typeof import("./config").initialise;

beforeAll(async () => {
    ({ initialise, removeVaultSettings } = await import("./config"));
});

/** An in-memory config file with the FileStorage methods config.ts uses */
function memoryStorage(contents: Record<string, unknown>) {
    const data: Record<string, unknown> = { ...contents };
    return {
        data,
        getValues: async () => ({ ...data }),
        getValue: async (key: string) => (key in data ? data[key] : null),
        setValue: async (key: string, value: unknown) => {
            data[key] = value;
        },
        setValues: async (values: Record<string, unknown>) => {
            Object.assign(data, values);
        },
        removeKey: async (key: string) => {
            delete data[key];
        }
    };
}

describe("initialise", () => {
    test("removes from the stored config a key that a migration dropped", async () => {
        const storage = memoryStorage({ fileHostKey: "secret", windowWidth: 640 });
        mockGetConfigStorage.mockReturnValue(storage);
        mockRunConfigMigrations.mockImplementation((config) => {
            const migrated = { ...config };
            delete migrated.fileHostKey;
            return [migrated, true];
        });
        await initialise();
        expect("fileHostKey" in storage.data).toBe(false);
        expect(storage.data.windowWidth).toBe(640);
    });

    test("removes nothing when no migration ran", async () => {
        const storage = memoryStorage({ windowWidth: 640, custom: 1 });
        mockGetConfigStorage.mockReturnValue(storage);
        mockRunConfigMigrations.mockImplementation((config) => [config, false]);
        await initialise();
        expect(storage.data.custom).toBe(1);
        expect(storage.data.windowWidth).toBe(640);
    });

    test("does not fill in a file host key for a new config", async () => {
        const storage = memoryStorage({});
        mockGetConfigStorage.mockReturnValue(storage);
        mockRunConfigMigrations.mockImplementation((config) => [config, false]);
        await initialise();
        expect("fileHostKey" in storage.data).toBe(false);
        expect(storage.data.windowWidth).toBe(800);
    });
});

beforeEach(() => {
    mockUnlink.mockReset();
    mockLogErr.mockClear();
});

test("removes the vault's settings file", async () => {
    mockUnlink.mockResolvedValue(undefined);
    await removeVaultSettings("abc");
    expect(mockUnlink).toHaveBeenCalledWith("/settings/vault-config-abc.json");
    expect(mockLogErr).not.toHaveBeenCalled();
});

test("ignores a vault that never had a settings file", async () => {
    mockUnlink.mockRejectedValue(
        Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" })
    );
    await removeVaultSettings("abc");
    expect(mockLogErr).not.toHaveBeenCalled();
});

test("logs other failures", async () => {
    mockUnlink.mockRejectedValue(
        Object.assign(new Error("EPERM: not permitted"), { code: "EPERM" })
    );
    await removeVaultSettings("abc");
    expect(mockLogErr).toHaveBeenCalledTimes(1);
});
