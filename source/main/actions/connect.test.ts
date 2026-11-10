import { jest } from "@jest/globals";

const mockAddVault = jest.fn(async () => "source-new");

jest.unstable_mockModule("electron", () => ({ BrowserWindow: class {}, dialog: {} }));
jest.unstable_mockModule("buttercup", () => ({
    Credentials: {
        fromDatasource: (config: unknown, password: string) => ({ config, password }),
        fromPassword: (password: string) => ({ password })
    }
}));
jest.unstable_mockModule("../services/buttercup", () => ({
    addVault: mockAddVault,
    findSourceByLocationKey: () => null
}));
jest.unstable_mockModule("../library/log", () => ({ logInfo: jest.fn(), logWarn: jest.fn() }));
jest.unstable_mockModule("../services/vaultFile", () => ({ isVaultFile: async () => true }));
jest.unstable_mockModule("../library/vaultLocation", () => ({ getVaultLocationKey: () => null }));
jest.unstable_mockModule("../../shared/i18n/trans", () => ({ t: (key: string) => key }));

let addVaultFromPayload: typeof import("./connect").addVaultFromPayload;

beforeAll(async () => {
    ({ addVaultFromPayload } = await import("./connect"));
});

beforeEach(() => {
    mockAddVault.mockClear();
});

function payload(masterPassword: string, createNew: boolean) {
    return {
        createNew,
        datasourceConfig: { type: "file", path: "/vaults/test.bcup" },
        masterPassword,
        fileNameOverride: null
    } as any;
}

test("refuses to create a vault with a password under 8 characters (B-758)", async () => {
    await expect(addVaultFromPayload(payload("Zq8#vLm", true))).rejects.toThrow(
        "master-password-policy.too-short"
    );
    expect(mockAddVault).not.toHaveBeenCalled();
});

test("refuses to create a vault with a common password (B-758)", async () => {
    await expect(addVaultFromPayload(payload("Password1", true))).rejects.toThrow(
        "master-password-policy.common"
    );
    expect(mockAddVault).not.toHaveBeenCalled();
});

test("creates a vault with a password that passes the rules", async () => {
    await expect(addVaultFromPayload(payload("Zq8#vLm2 new", true))).resolves.toBe("source-new");
    expect(mockAddVault).toHaveBeenCalledTimes(1);
});

test("still adds an existing vault whatever its password", async () => {
    await expect(addVaultFromPayload(payload("1", false))).resolves.toBe("source-new");
    expect(mockAddVault).toHaveBeenCalledTimes(1);
});
