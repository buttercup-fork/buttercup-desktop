import { EventEmitter } from "events";
import { jest } from "@jest/globals";

class MockAutoUpdater extends EventEmitter {
    quitAndInstallCalled = false;
    quitAndInstall = jest.fn<() => void>();
    downloadUpdate = jest.fn<() => Promise<void>>();
    checkForUpdates = jest.fn<() => Promise<unknown>>();
    setFeedURL = jest.fn();
    allowPrerelease = false;
    autoDownload = false;
}

const mockApp = new EventEmitter();
const mockAutoUpdater = new MockAutoUpdater();
const mockShowMessageBox = jest.fn<(...args: Array<any>) => Promise<{ response: number }>>();
const mockOpenExternal = jest.fn();

jest.unstable_mockModule("electron", () => ({
    app: mockApp,
    dialog: { showMessageBox: mockShowMessageBox }
}));
jest.unstable_mockModule("electron-updater", () => ({ autoUpdater: mockAutoUpdater }));
jest.unstable_mockModule("electron-is-dev", () => ({ default: false }));
jest.unstable_mockModule("delayable-setinterval", () => ({
    clearDelayedInterval: jest.fn(),
    setDelayedInterval: jest.fn()
}));
jest.unstable_mockModule("./windows", () => ({ getMainWindow: () => null }));
jest.unstable_mockModule("./config", () => ({
    getConfigValue: jest.fn(async () => ({ prereleaseUpdates: false }))
}));
// Checks run at once in these tests, not 2.5 s after the last call
jest.unstable_mockModule("debounce-promise", () => ({ default: (fn: unknown) => fn }));
jest.unstable_mockModule("./navigation", () => ({ openExternalSafely: mockOpenExternal }));
jest.unstable_mockModule("../library/log", () => ({
    logErr: jest.fn(),
    logInfo: jest.fn(),
    logWarn: jest.fn()
}));
jest.unstable_mockModule("../library/file", () => ({ fileExists: jest.fn() }));
jest.unstable_mockModule("../../shared/i18n/trans", () => ({ t: (key: string) => key }));

let installUpdate: typeof import("./update").installUpdate;
let startUpdate: typeof import("./update").startUpdate;
let checkForUpdate: typeof import("./update").checkForUpdate;
let disableUpdates: typeof import("./update").disableUpdates;
let getUpdateStatus: typeof import("./update").getUpdateStatus;

beforeAll(async () => {
    ({ installUpdate, startUpdate, checkForUpdate, disableUpdates, getUpdateStatus } =
        await import("./update"));
});

beforeEach(() => {
    mockAutoUpdater.removeAllListeners();
    mockApp.removeAllListeners();
    mockAutoUpdater.quitAndInstallCalled = false;
    mockAutoUpdater.quitAndInstall.mockReset();
    mockAutoUpdater.downloadUpdate.mockReset();
    mockShowMessageBox.mockReset();
    mockShowMessageBox.mockResolvedValue({ response: 1 });
    mockOpenExternal.mockClear();
});

// What electron-updater does: start the installer, then quit on the next
// round of the event loop. A failed start is reported before that.
function simulateInstall(installerError: Error | null) {
    mockAutoUpdater.quitAndInstall.mockImplementation(() => {
        mockAutoUpdater.quitAndInstallCalled = true;
        if (installerError) {
            process.nextTick(() => mockAutoUpdater.emit("error", installerError));
        }
    });
}

function quit(): { prevented: boolean } {
    const event = { prevented: false, preventDefault: () => (event.prevented = true) };
    mockApp.emit("before-quit", event);
    return event;
}

const nextRound = () => new Promise((resolve) => setImmediate(resolve));

test("lets the app quit when the installer starts", async () => {
    simulateInstall(null);
    installUpdate();
    await nextRound();
    expect(quit().prevented).toBe(false);
    expect(mockShowMessageBox).not.toHaveBeenCalled();
});

test("stays open and explains when the installer can't start (#690)", async () => {
    simulateInstall(new Error("spawn EACCES"));
    installUpdate();
    await nextRound();
    expect(quit().prevented).toBe(true);
    await nextRound();
    const options = mockShowMessageBox.mock.calls[0][0];
    expect(options.message).toBe("update.install-failed.message");
    expect(options.detail).toBe("spawn EACCES");
    // A later quit isn't blocked again
    expect(quit().prevented).toBe(false);
});

test("opens the download page on request", async () => {
    mockShowMessageBox.mockResolvedValue({ response: 0 });
    simulateInstall(new Error("spawn UNKNOWN"));
    installUpdate();
    await nextRound();
    quit();
    await nextRound();
    expect(mockOpenExternal).toHaveBeenCalledWith(
        "https://github.com/buttercup-fork/buttercup-desktop/releases/latest"
    );
});

test("starting an update opens the releases page and downloads nothing (D-017)", async () => {
    await startUpdate();
    expect(mockOpenExternal).toHaveBeenCalledWith(
        "https://github.com/buttercup-fork/buttercup-desktop/releases/latest"
    );
    expect(mockAutoUpdater.downloadUpdate).not.toHaveBeenCalled();
});

test("doesn't watch quits when there was nothing to install", async () => {
    mockAutoUpdater.quitAndInstall.mockImplementation(() => {
        mockAutoUpdater.emit("error", new Error("No update filepath provided"));
    });
    installUpdate();
    await nextRound();
    expect(quit().prevented).toBe(false);
    expect(mockAutoUpdater.listenerCount("error")).toBe(0);
});

// The About dialog shows the result of the last check (B-810). The updater's
// listeners are attached once, at the first check, so one test follows them.
describe("update status", () => {
    test("follows each check", async () => {
        expect(getUpdateStatus()).toEqual({ state: "not-checked" });

        let finish: (value: unknown) => void;
        mockAutoUpdater.checkForUpdates.mockImplementation(
            () => new Promise((resolve) => (finish = resolve))
        );
        const running = checkForUpdate();
        await nextRound();
        expect(getUpdateStatus()).toEqual({ state: "checking" });
        mockAutoUpdater.emit("update-not-available");
        finish(null);
        await running;
        expect(getUpdateStatus()).toEqual({ state: "up-to-date", checkedAt: expect.any(Number) });

        mockAutoUpdater.checkForUpdates.mockImplementation(async () => {
            mockAutoUpdater.emit("update-available", { version: "3.0.1", releaseDate: "" });
        });
        await checkForUpdate();
        expect(getUpdateStatus()).toEqual({
            state: "available",
            version: "3.0.1",
            checkedAt: expect.any(Number)
        });

        mockAutoUpdater.checkForUpdates.mockImplementation(async () => {
            mockAutoUpdater.emit("error", new Error("net::ERR_INTERNET_DISCONNECTED"));
        });
        await checkForUpdate();
        expect(getUpdateStatus()).toEqual({ state: "failed", checkedAt: expect.any(Number) });

        mockAutoUpdater.checkForUpdates.mockRejectedValue(new Error("feed broke"));
        await checkForUpdate();
        expect(getUpdateStatus()).toEqual({ state: "failed", checkedAt: expect.any(Number) });

        // An error outside a check (a failed install) leaves the last result
        mockAutoUpdater.checkForUpdates.mockImplementation(async () => {
            mockAutoUpdater.emit("update-not-available");
        });
        await checkForUpdate();
        mockAutoUpdater.emit("error", new Error("spawn EACCES"));
        expect(getUpdateStatus().state).toBe("up-to-date");
    });

    // Last: disabling can't be undone in a run
    test("reports checks as off after --no-update", () => {
        disableUpdates();
        expect(getUpdateStatus()).toEqual({ state: "off" });
    });
});
