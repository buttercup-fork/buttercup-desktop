import { jest } from "@jest/globals";

// Passes the new-password rules (B-758)
const NEW = "Zq8#vLm2 new";
const calls: Array<string> = [];
let mockStatus = "unlocked";
let mockPasswordMatches = true;
const mockChange = jest.fn(async () => {
    calls.push("change");
});
const mockExport = jest.fn(async () => {
    calls.push("export");
    return "encrypted-vault";
});
const mockBackup = jest.fn(async () => {
    calls.push("backup");
    return "/backup/source-1/password-change.bcup";
});
const mockReplaceBiometric = jest.fn(async () => false);
const mockDisableBiometric = jest.fn(async () => {});

jest.unstable_mockModule("buttercup", () => ({
    VaultSourceStatus: { Locked: "locked", Unlocked: "unlocked" }
}));
jest.unstable_mockModule("./buttercup", () => ({
    changeSourceMasterPassword: mockChange,
    exportSourceEncrypted: mockExport,
    getSourceStatus: () => mockStatus,
    testSourceMasterPassword: async () => mockPasswordMatches
}));
jest.unstable_mockModule("./backup", () => ({ writePasswordChangeBackup: mockBackup }));
jest.unstable_mockModule("./biometrics", () => ({
    disableSourceBiometricUnlock: mockDisableBiometric,
    replaceSourceBiometricPassword: mockReplaceBiometric
}));
jest.unstable_mockModule("../library/log", () => ({ logErr: jest.fn(), logInfo: jest.fn() }));

let changeVaultMasterPassword: typeof import("./masterPassword").changeVaultMasterPassword;

beforeAll(async () => {
    ({ changeVaultMasterPassword } = await import("./masterPassword"));
});

beforeEach(() => {
    calls.length = 0;
    mockStatus = "unlocked";
    mockPasswordMatches = true;
    mockReplaceBiometric.mockImplementation(async () => false);
    for (const mock of [mockChange, mockExport, mockBackup, mockDisableBiometric]) {
        mock.mockClear();
    }
});

test("writes the backup with the current password before changing it", async () => {
    const result = await changeVaultMasterPassword("source-1", "old", NEW);
    expect(result).toEqual({
        ok: true,
        backupPath: "/backup/source-1/password-change.bcup",
        biometrics: "none"
    });
    expect(calls).toEqual(["export", "backup", "change"]);
    expect(mockExport).toHaveBeenCalledWith("source-1", "old");
    expect(mockBackup).toHaveBeenCalledWith("source-1", "encrypted-vault");
    expect(mockChange).toHaveBeenCalledWith("source-1", "old", NEW);
});

test("refuses a locked vault", async () => {
    mockStatus = "locked";
    const result = await changeVaultMasterPassword("source-1", "old", NEW);
    expect(result).toEqual({ ok: false, reason: "not-unlocked" });
    expect(calls).toEqual([]);
});

test("refuses a wrong current password", async () => {
    mockPasswordMatches = false;
    const result = await changeVaultMasterPassword("source-1", "wrong", NEW);
    expect(result).toEqual({ ok: false, reason: "invalid-password" });
    expect(calls).toEqual([]);
});

test("refuses a new password that is empty or the same", async () => {
    expect(await changeVaultMasterPassword("source-1", "old", "old")).toEqual({
        ok: false,
        reason: "same-password"
    });
    expect(await changeVaultMasterPassword("source-1", "old", "")).toEqual({
        ok: false,
        reason: "same-password"
    });
    expect(calls).toEqual([]);
});

test("refuses a new password shorter than 8 characters (B-758)", async () => {
    expect(await changeVaultMasterPassword("source-1", "old", "Zq8#vLm")).toEqual({
        ok: false,
        reason: "too-short"
    });
    expect(calls).toEqual([]);
});

test("refuses a common new password in any case (B-758)", async () => {
    expect(await changeVaultMasterPassword("source-1", "old", "Password1")).toEqual({
        ok: false,
        reason: "common-password"
    });
    expect(await changeVaultMasterPassword("source-1", "old", "ILOVEYOU")).toEqual({
        ok: false,
        reason: "common-password"
    });
    expect(calls).toEqual([]);
});

test("does not change the password when the backup fails", async () => {
    mockBackup.mockImplementationOnce(async () => {
        throw new Error("disk full");
    });
    await expect(changeVaultMasterPassword("source-1", "old", NEW)).rejects.toThrow("disk full");
    expect(mockChange).not.toHaveBeenCalled();
});

test("stores the new password for biometric unlock", async () => {
    mockReplaceBiometric.mockImplementation(async () => true);
    const result = await changeVaultMasterPassword("source-1", "old", NEW);
    expect(result).toMatchObject({ ok: true, biometrics: "updated" });
    expect(mockReplaceBiometric).toHaveBeenCalledWith("source-1", NEW);
});

test("turns biometric unlock off when the keychain can't be updated", async () => {
    mockReplaceBiometric.mockImplementation(async () => {
        throw new Error("keychain locked");
    });
    const result = await changeVaultMasterPassword("source-1", "old", NEW);
    expect(result).toMatchObject({ ok: true, biometrics: "removed" });
    expect(mockDisableBiometric).toHaveBeenCalledWith("source-1");
});
