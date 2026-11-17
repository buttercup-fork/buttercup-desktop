import { jest } from "@jest/globals";
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { Credentials, MemoryStorageInterface, init } from "buttercup";

const RIGHT = "right password for the test vault";
const WRONG = "wrong password for the test vault";

jest.unstable_mockModule("electron", () => ({ BrowserWindow: class {} }));
jest.unstable_mockModule("@buttercup/exporter", () => ({ exportVaultToCSV: jest.fn() }));
jest.unstable_mockModule("./storage", () => {
    const cache = new MemoryStorageInterface();
    const sources = new MemoryStorageInterface();
    return { getVaultCacheStorage: () => cache, getVaultStorage: () => sources };
});
jest.unstable_mockModule("./facades", () => ({ clearFacadeCache: jest.fn() }));
jest.unstable_mockModule("./windows", () => ({ notifyWindowsOfSourceUpdate: jest.fn() }));
jest.unstable_mockModule("./search", () => ({ updateSearchCaches: jest.fn() }));
jest.unstable_mockModule("./autoLock", () => ({
    setAutoLockSuspended: jest.fn(),
    startAutoVaultLockTimer: jest.fn(async () => {})
}));
jest.unstable_mockModule("../library/log", () => ({
    log: jest.fn(),
    logErr: jest.fn(),
    logInfo: jest.fn(),
    logWarn: jest.fn()
}));
jest.unstable_mockModule("./backup", () => ({ attachSourceEncryptedListeners: jest.fn() }));
jest.unstable_mockModule("./damagedVault", () => ({ offerOfflineCopyRestore: jest.fn() }));
jest.unstable_mockModule("./insecureWebDAV", () => ({ offerInsecureWebDAVUnlock: jest.fn() }));
jest.unstable_mockModule("../../shared/i18n/trans", () => ({ t: (key: string) => key }));

let service: typeof import("./buttercup");
let dir: string;
let vaultPath: string;

function add(password: string, createNew: boolean) {
    return service.addVault(
        "test",
        Credentials.fromDatasource({ type: "file", path: vaultPath }, password),
        Credentials.fromPassword(password),
        "file" as any,
        createNew
    );
}

beforeAll(async () => {
    init();
    service = await import("./buttercup");
    dir = mkdtempSync(path.join(os.tmpdir(), "bcup-addvault-"));
    vaultPath = path.join(dir, "test.bcup");
    // A real vault file with the right password, then out of the list again
    const id = await add(RIGHT, true);
    await service.lockSource(id);
    await service.removeSource(id);
});

afterAll(async () => {
    // Stop the vault manager's auto-update timer, or jest does not exit
    await service.toggleAutoUpdate(false);
    await service.lockAllSources();
    if (dir) rmSync(dir, { recursive: true, force: true });
});

test("a vault that fails to add with the wrong password is not left in the list (B-798)", async () => {
    await expect(add(WRONG, false)).rejects.toThrow();
    expect(service.getSourceDescriptions()).toEqual([]);
});

test("the same vault then adds and unlocks with the right password (B-798)", async () => {
    const id = await add(RIGHT, false);
    expect(service.getSourceDescriptions().map((source) => source.id)).toEqual([id]);
    expect(service.isSourceUnlocked(id)).toBe(true);
});
