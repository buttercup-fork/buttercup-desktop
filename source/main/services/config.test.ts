import { jest } from "@jest/globals";

const mockUnlink = jest.fn<(path: string) => Promise<void>>();
const mockLogErr = jest.fn();

jest.unstable_mockModule("fs/promises", () => ({ default: { unlink: mockUnlink } }));
jest.unstable_mockModule("./storage", () => ({
    getConfigStorage: jest.fn(),
    getVaultSettingsPath: (sourceID: string) => `/settings/vault-config-${sourceID}.json`,
    getVaultSettingsStorage: jest.fn()
}));
jest.unstable_mockModule("./migration", () => ({ runConfigMigrations: jest.fn() }));
jest.unstable_mockModule("../library/log", () => ({ logErr: mockLogErr, logInfo: jest.fn() }));

let removeVaultSettings: typeof import("./config").removeVaultSettings;

beforeAll(async () => {
    ({ removeVaultSettings } = await import("./config"));
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
