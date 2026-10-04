import { jest } from "@jest/globals";

let mockUnsaved: Array<string> = [];
const mockSaveSource = jest.fn<(sourceID: string) => Promise<void>>();
const mockLockSource = jest.fn<(sourceID: string) => Promise<void>>(() => Promise.resolve());
const mockLockAllSources = jest.fn<() => Promise<void>>(() => Promise.resolve());
const mockShowMessageBox = jest.fn<(...args: Array<any>) => Promise<{ response: number }>>();
const mockLogErr = jest.fn();
const mockWaitForRunningSaves =
    jest.fn<(sourceIDs: Array<string>, timeout: number) => Promise<void>>();

jest.unstable_mockModule("electron", () => ({ dialog: { showMessageBox: mockShowMessageBox } }));
jest.unstable_mockModule("../services/buttercup", () => ({
    getSourceDescriptions: () => [
        { id: "a", name: "Personal" },
        { id: "b", name: "Work" }
    ],
    getUnsavedSourceIDs: () => mockUnsaved,
    lockAllSources: mockLockAllSources,
    lockSource: mockLockSource,
    saveSource: mockSaveSource,
    waitForRunningSaves: mockWaitForRunningSaves
}));
jest.unstable_mockModule("../services/windows", () => ({ getMainWindow: () => null }));
jest.unstable_mockModule("../library/log", () => ({
    logErr: mockLogErr,
    logInfo: jest.fn(),
    logWarn: jest.fn()
}));
jest.unstable_mockModule("../../shared/i18n/trans", () => ({
    t: (key: string, options?: Record<string, unknown>) => {
        const { interpolation, ...vars } = options ?? {};
        return Object.keys(vars).length > 0 ? `${key} ${JSON.stringify(vars)}` : key;
    }
}));

let unsaved: typeof import("./unsaved");

beforeAll(async () => {
    unsaved = await import("./unsaved");
});

beforeEach(() => {
    mockUnsaved = [];
    mockSaveSource.mockReset();
    mockSaveSource.mockResolvedValue(undefined);
    mockLockSource.mockClear();
    mockLockAllSources.mockClear();
    mockShowMessageBox.mockReset();
    mockLogErr.mockClear();
    mockWaitForRunningSaves.mockReset();
    mockWaitForRunningSaves.mockResolvedValue(undefined);
});

const messages = () => mockShowMessageBox.mock.calls.map((call) => call[call.length - 1].message);

describe("confirmUnsavedChanges", () => {
    test("goes ahead without asking when everything is saved", async () => {
        expect(await unsaved.confirmUnsavedChanges("quit")).toBe(true);
        expect(mockShowMessageBox).not.toHaveBeenCalled();
    });

    test("doesn't ask when a running save finishes in time", async () => {
        mockUnsaved = ["a"];
        mockWaitForRunningSaves.mockImplementation(async () => {
            mockUnsaved = [];
        });
        expect(await unsaved.confirmUnsavedChanges("quit")).toBe(true);
        expect(mockWaitForRunningSaves).toHaveBeenCalledWith(["a"], 5000);
        expect(mockShowMessageBox).not.toHaveBeenCalled();
    });

    test("only asks about the vaults being locked", async () => {
        mockUnsaved = ["b"];
        expect(await unsaved.confirmUnsavedChanges("lock", ["a"])).toBe(true);
        expect(mockShowMessageBox).not.toHaveBeenCalled();
    });

    test("names the vaults and stops on Cancel", async () => {
        mockUnsaved = ["a", "b"];
        mockShowMessageBox.mockResolvedValue({ response: 2 });
        expect(await unsaved.confirmUnsavedChanges("quit")).toBe(false);
        const options = mockShowMessageBox.mock.calls[0][0];
        expect(options.detail).toBe('dialog.unsaved-changes.detail {"names":"Personal, Work"}');
        expect(options.buttons).toEqual([
            "dialog.unsaved-changes.save-quit",
            "dialog.unsaved-changes.quit-anyway",
            "dialog.unsaved-changes.cancel"
        ]);
        expect(mockSaveSource).not.toHaveBeenCalled();
    });

    test("goes ahead without saving on Quit Anyway", async () => {
        mockUnsaved = ["a"];
        mockShowMessageBox.mockResolvedValue({ response: 1 });
        expect(await unsaved.confirmUnsavedChanges("quit")).toBe(true);
        expect(mockSaveSource).not.toHaveBeenCalled();
    });

    test("saves first on Save and Quit", async () => {
        mockUnsaved = ["a", "b"];
        mockShowMessageBox.mockResolvedValue({ response: 0 });
        expect(await unsaved.confirmUnsavedChanges("quit")).toBe(true);
        expect(mockSaveSource.mock.calls).toEqual([["a"], ["b"]]);
    });

    test("stops and explains when the save fails again", async () => {
        mockUnsaved = ["a"];
        mockShowMessageBox.mockResolvedValue({ response: 0 });
        mockSaveSource.mockRejectedValue(new Error("EPERM"));
        expect(await unsaved.confirmUnsavedChanges("lock")).toBe(false);
        expect(messages()).toEqual([
            "dialog.unsaved-changes.message-lock",
            "dialog.unsaved-changes.save-failed-lock"
        ]);
        expect(mockShowMessageBox.mock.calls[1][0].detail).toBe("Personal: EPERM");
    });
});

describe("lockSourceAfterConfirming", () => {
    test("locks after Lock Anyway", async () => {
        mockUnsaved = ["a"];
        mockShowMessageBox.mockResolvedValue({ response: 1 });
        expect(await unsaved.lockSourceAfterConfirming("a")).toBe(true);
        expect(mockLockSource).toHaveBeenCalledWith("a");
    });

    test("leaves the vault unlocked on Cancel", async () => {
        mockUnsaved = ["a"];
        mockShowMessageBox.mockResolvedValue({ response: 2 });
        expect(await unsaved.lockSourceAfterConfirming("a")).toBe(false);
        expect(mockLockSource).not.toHaveBeenCalled();
    });
});

describe("lockAllSourcesAfterSaving", () => {
    test("just locks when everything is saved", async () => {
        await unsaved.lockAllSourcesAfterSaving();
        expect(mockSaveSource).not.toHaveBeenCalled();
        expect(mockLockAllSources).toHaveBeenCalledTimes(1);
        expect(mockShowMessageBox).not.toHaveBeenCalled();
    });

    test("saves unsaved vaults before locking", async () => {
        mockUnsaved = ["a"];
        const order: Array<string> = [];
        mockSaveSource.mockImplementation(async () => void order.push("save"));
        mockLockAllSources.mockImplementationOnce(async () => void order.push("lock"));
        await unsaved.lockAllSourcesAfterSaving();
        expect(order).toEqual(["save", "lock"]);
        expect(mockShowMessageBox).not.toHaveBeenCalled();
    });

    test("locks anyway when saving fails, and says the changes are lost", async () => {
        mockUnsaved = ["a", "b"];
        mockShowMessageBox.mockResolvedValue({ response: 0 });
        mockSaveSource.mockImplementation(async (sourceID) => {
            if (sourceID === "b") throw new Error("offline");
        });
        await unsaved.lockAllSourcesAfterSaving();
        expect(mockLockAllSources).toHaveBeenCalledTimes(1);
        expect(messages()).toEqual(['dialog.unsaved-changes.lost-on-auto-lock {"names":"Work"}']);
        expect(mockLogErr).toHaveBeenCalled();
    });

    test("doesn't wait forever for a stalled save", async () => {
        jest.useFakeTimers();
        try {
            mockUnsaved = ["a"];
            mockShowMessageBox.mockResolvedValue({ response: 0 });
            mockSaveSource.mockReturnValue(new Promise(() => {}));
            const locking = unsaved.lockAllSourcesAfterSaving();
            await jest.advanceTimersByTimeAsync(15 * 1000);
            await locking;
            expect(mockLockAllSources).toHaveBeenCalledTimes(1);
            expect(mockShowMessageBox.mock.calls[0][0].detail).toBe(
                "Personal: dialog.unsaved-changes.timeout"
            );
        } finally {
            jest.useRealTimers();
        }
    });
});

describe("lockSourceAfterSaving", () => {
    test("saves only that vault's changes, then locks only that vault", async () => {
        mockUnsaved = ["a", "b"];
        const order: Array<string> = [];
        mockSaveSource.mockImplementation(async (sourceID) => void order.push(`save ${sourceID}`));
        mockLockSource.mockImplementationOnce(
            async (sourceID) => void order.push(`lock ${sourceID}`)
        );
        await unsaved.lockSourceAfterSaving("b");
        expect(order).toEqual(["save b", "lock b"]);
        expect(mockLockAllSources).not.toHaveBeenCalled();
        expect(mockShowMessageBox).not.toHaveBeenCalled();
    });

    test("locks anyway when saving fails, and says the changes are lost", async () => {
        mockUnsaved = ["a"];
        mockShowMessageBox.mockResolvedValue({ response: 0 });
        mockSaveSource.mockRejectedValue(new Error("offline"));
        await unsaved.lockSourceAfterSaving("a");
        expect(mockLockSource).toHaveBeenCalledWith("a");
        expect(messages()).toEqual([
            'dialog.unsaved-changes.lost-on-auto-lock {"names":"Personal"}'
        ]);
    });
});
