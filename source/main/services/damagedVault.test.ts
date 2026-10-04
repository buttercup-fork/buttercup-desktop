import { jest } from "@jest/globals";

const calls: Array<string> = [];
let mockResponse = 0;
const mockShowMessageBox = jest.fn(async (..._args: Array<any>) => {
    calls.push("ask");
    return { response: mockResponse };
});
const mockBackup = jest.fn(async (..._args: Array<any>) => {
    calls.push("backup");
    return "/backup/source-1/damaged.bcup";
});

jest.unstable_mockModule("electron", () => ({
    dialog: { showMessageBox: mockShowMessageBox }
}));
jest.unstable_mockModule("buttercup", () => ({
    Credentials: { fromPassword: (password: string) => ({ password }) },
    VaultSourceStatus: { Locked: "locked", Unlocked: "unlocked" }
}));
jest.unstable_mockModule("./backup", () => ({ writeDamagedVaultBackup: mockBackup }));
jest.unstable_mockModule("./windows", () => ({ getMainWindow: () => null }));
jest.unstable_mockModule("../library/log", () => ({ logErr: jest.fn(), logInfo: jest.fn() }));
jest.unstable_mockModule("../../shared/i18n/trans", () => ({
    t: (key: string) => key
}));

let offerOfflineCopyRestore: typeof import("./damagedVault").offerOfflineCopyRestore;

beforeAll(async () => {
    ({ offerOfflineCopyRestore } = await import("./damagedVault"));
});

function createSource(type = "file", hasCopy = true) {
    const source: any = {
        id: "source-1",
        name: "Vault",
        type,
        status: "locked",
        _datasource: { path: "/vaults/vault.bcup" },
        checkOfflineCopy: jest.fn(async () => hasCopy),
        unlock: jest.fn(async (..._args: Array<any>) => {
            calls.push("unlock-copy");
            source.status = "unlocked";
        }),
        lock: jest.fn(async () => {
            calls.push("lock");
            source.status = "locked";
        }),
        restoreOfflineCopy: jest.fn(async () => {
            calls.push("restore");
        })
    };
    return source;
}

beforeEach(() => {
    calls.length = 0;
    mockResponse = 0;
    mockShowMessageBox.mockClear();
    mockBackup.mockClear();
});

test("does nothing without an offline copy", async () => {
    const source = createSource("file", false);
    expect(await offerOfflineCopyRestore(source, "pass")).toBe(false);
    expect(calls).toEqual([]);
});

test("opens the copy, asks, backs up the damaged file, then restores", async () => {
    const source = createSource();
    expect(await offerOfflineCopyRestore(source, "pass")).toBe(true);
    expect(calls).toEqual(["unlock-copy", "ask", "backup", "restore"]);
    expect(source.unlock).toHaveBeenCalledWith(
        { password: "pass" },
        { loadOfflineCopy: true, storeOfflineCopy: false }
    );
    expect(mockBackup).toHaveBeenCalledWith("source-1", "/vaults/vault.bcup");
    expect(mockShowMessageBox.mock.calls[0][0]).toMatchObject({
        detail: "dialog.restore-offline-copy.detail-file"
    });
});

test("doesn't ask when the password doesn't open the copy", async () => {
    const source = createSource();
    source.unlock.mockImplementation(async () => {
        throw new Error("Authentication failed");
    });
    await expect(offerOfflineCopyRestore(source, "wrong")).rejects.toThrow("Authentication failed");
    expect(mockShowMessageBox).not.toHaveBeenCalled();
    expect(source.restoreOfflineCopy).not.toHaveBeenCalled();
});

test("locks the copy again when the user cancels", async () => {
    mockResponse = 1;
    const source = createSource();
    expect(await offerOfflineCopyRestore(source, "pass")).toBe(false);
    expect(calls).toEqual(["unlock-copy", "ask", "lock"]);
    expect(source.status).toBe("locked");
});

test("skips the file backup for remote vaults", async () => {
    const source = createSource("webdav");
    expect(await offerOfflineCopyRestore(source, "pass")).toBe(true);
    expect(calls).toEqual(["unlock-copy", "ask", "restore"]);
    expect(mockShowMessageBox.mock.calls[0][0]).toMatchObject({
        detail: "dialog.restore-offline-copy.detail-remote"
    });
});

test("locks and explains when the restore fails, without restoring if the backup fails", async () => {
    mockBackup.mockImplementationOnce(async () => {
        throw new Error("EACCES");
    });
    const source = createSource();
    await expect(offerOfflineCopyRestore(source, "pass")).rejects.toThrow(
        "error.vault-restore-failed"
    );
    expect(source.restoreOfflineCopy).not.toHaveBeenCalled();
    expect(source.status).toBe("locked");
});
