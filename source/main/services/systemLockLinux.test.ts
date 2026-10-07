import { EventEmitter } from "events";
import { PassThrough } from "stream";
import { jest } from "@jest/globals";

const mockApp = new EventEmitter();
const mockPowerMonitor = new EventEmitter();
const mockLockAll = jest.fn<() => Promise<void>>();
const mockUnlockedCount = jest.fn<() => number>();
const mockGetConfigValue = jest.fn<(key: string) => Promise<any>>();
const mockWarn = jest.fn();

class FakeChild extends EventEmitter {
    stdout = new PassThrough();
    kill = jest.fn();
}
let children: Array<FakeChild> = [];
const mockSpawn = jest.fn((..._args: Array<any>) => {
    const child = new FakeChild();
    children.push(child);
    return child;
});

jest.unstable_mockModule("electron", () => ({ app: mockApp, powerMonitor: mockPowerMonitor }));
jest.unstable_mockModule("node:child_process", () => ({ spawn: mockSpawn }));
jest.unstable_mockModule("./config", () => ({ getConfigValue: mockGetConfigValue }));
jest.unstable_mockModule("./buttercup", () => ({ getUnlockedSourcesCount: mockUnlockedCount }));
jest.unstable_mockModule("../actions/unsaved", () => ({ lockAllSourcesAfterSaving: mockLockAll }));
jest.unstable_mockModule("../library/log", () => ({
    logErr: jest.fn(),
    logInfo: jest.fn(),
    logWarn: mockWarn
}));

const LOCK = [
    "signal time=1.0 sender=:1.35 -> destination=(null destination) serial=1 path=/org/gnome/ScreenSaver; interface=org.gnome.ScreenSaver; member=ActiveChanged",
    "   boolean true",
    ""
].join("\n");

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

let startSystemLockWatcher: typeof import("./systemLock").startSystemLockWatcher;
const realPlatform = process.platform;

beforeAll(async () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    ({ startSystemLockWatcher } = await import("./systemLock"));
});

afterAll(() => {
    Object.defineProperty(process, "platform", { value: realPlatform });
});

beforeEach(() => {
    mockApp.removeAllListeners();
    mockPowerMonitor.removeAllListeners();
    children = [];
    mockSpawn.mockClear();
    mockWarn.mockClear();
    mockLockAll.mockReset();
    mockLockAll.mockResolvedValue(undefined);
    mockUnlockedCount.mockReturnValue(1);
    mockGetConfigValue.mockResolvedValue({ lockVaultsOnSystemLock: true });
});

test("on Linux it watches D-Bus and locks the vaults when the screen locks", async () => {
    startSystemLockWatcher();
    expect(mockSpawn).toHaveBeenCalledWith(
        "dbus-monitor",
        ["--session", "type='signal',member='ActiveChanged'"],
        expect.anything()
    );
    children[0].stdout.write(LOCK + LOCK);
    await tick();
    // GNOME sends the signal twice: still one lock
    expect(mockLockAll).toHaveBeenCalledTimes(1);
});

test("it does nothing when the setting is off", async () => {
    mockGetConfigValue.mockResolvedValue({ lockVaultsOnSystemLock: false });
    startSystemLockWatcher();
    children[0].stdout.write(LOCK);
    await tick();
    expect(mockLockAll).not.toHaveBeenCalled();
});

test("a missing dbus-monitor is logged and nothing else breaks", async () => {
    startSystemLockWatcher();
    const err: NodeJS.ErrnoException = new Error("spawn dbus-monitor ENOENT");
    err.code = "ENOENT";
    children[0].emit("error", err);
    children[0].emit("exit", null);
    await tick();
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining("dbus-bin"));
    expect(mockSpawn).toHaveBeenCalledTimes(1);
});

test("the watcher is stopped when the app quits", () => {
    startSystemLockWatcher();
    mockApp.emit("will-quit");
    expect(children[0].kill).toHaveBeenCalled();
});

test("sleep still locks the vaults", async () => {
    startSystemLockWatcher();
    mockPowerMonitor.emit("suspend");
    await tick();
    expect(mockLockAll).toHaveBeenCalledTimes(1);
});
