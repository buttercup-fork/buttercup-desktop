import { EventEmitter } from "events";
import { jest } from "@jest/globals";

const mockPowerMonitor = new EventEmitter();
const mockPreferences = { lockVaultsOnSystemLock: true };
const mockLockAllSources = jest.fn(() => Promise.resolve());
let mockUnlockedCount = 1;

jest.unstable_mockModule("electron", () => ({
    app: new EventEmitter(),
    powerMonitor: mockPowerMonitor
}));
jest.unstable_mockModule("./config", () => ({
    getConfigValue: () => Promise.resolve(mockPreferences)
}));
jest.unstable_mockModule("./buttercup", () => ({
    getUnlockedSourcesCount: () => mockUnlockedCount
}));
jest.unstable_mockModule("../actions/unsaved", () => ({
    lockAllSourcesAfterSaving: mockLockAllSources
}));
jest.unstable_mockModule("../library/log", () => ({
    logErr: jest.fn(),
    logInfo: jest.fn(),
    logWarn: jest.fn()
}));

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeAll(async () => {
    const { startSystemLockWatcher } = await import("./systemLock");
    startSystemLockWatcher();
});

beforeEach(() => {
    mockLockAllSources.mockClear();
    mockPreferences.lockVaultsOnSystemLock = true;
    mockUnlockedCount = 1;
});

test("locks all vaults when the screen locks", async () => {
    mockPowerMonitor.emit("lock-screen");
    await flush();
    expect(mockLockAllSources).toHaveBeenCalledTimes(1);
});

test("locks all vaults when the computer goes to sleep", async () => {
    mockPowerMonitor.emit("suspend");
    await flush();
    expect(mockLockAllSources).toHaveBeenCalledTimes(1);
});

test("does nothing when the preference is off", async () => {
    mockPreferences.lockVaultsOnSystemLock = false;
    mockPowerMonitor.emit("lock-screen");
    mockPowerMonitor.emit("suspend");
    await flush();
    expect(mockLockAllSources).not.toHaveBeenCalled();
});

test("does nothing when no vault is unlocked", async () => {
    mockUnlockedCount = 0;
    mockPowerMonitor.emit("lock-screen");
    await flush();
    expect(mockLockAllSources).not.toHaveBeenCalled();
});
