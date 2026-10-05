import { jest } from "@jest/globals";

const mockLogWarn = jest.fn();

jest.unstable_mockModule("../library/log", () => ({ logWarn: mockLogWarn }));

let lockVaultSource: typeof import("./lockVault").lockVaultSource;

beforeAll(async () => {
    ({ lockVaultSource } = await import("./lockVault"));
});

beforeEach(() => {
    mockLogWarn.mockClear();
});

// A vault source whose normal lock waits behind a save until `finishSave()`
function createSource({ saveRunning }: { saveRunning: boolean }) {
    let finishSave: () => void = () => {};
    const saved = saveRunning
        ? new Promise<void>((resolve) => {
              finishSave = resolve;
          })
        : Promise.resolve();
    const source: any = {
        id: "vault-1",
        status: "unlocked",
        lock: jest.fn(async (options: { force?: boolean } = {}) => {
            if (!options.force) {
                await saved;
                if (source.status === "locked") throw new Error("Source was locked");
            }
            source.status = "locked";
        })
    };
    return { source, finishSave: () => finishSave() };
}

describe("lockVaultSource", () => {
    test("locks normally when nothing is running", async () => {
        const { source } = createSource({ saveRunning: false });
        await lockVaultSource(source, 50);
        expect(source.status).toBe("locked");
        expect(source.lock).toHaveBeenCalledTimes(1);
        expect(source.lock).toHaveBeenCalledWith();
    });

    test("waits for a save that finishes in time", async () => {
        const { source, finishSave } = createSource({ saveRunning: true });
        const locking = lockVaultSource(source, 1000);
        setTimeout(finishSave, 20);
        await locking;
        expect(source.status).toBe("locked");
        expect(source.lock).toHaveBeenCalledTimes(1);
    });

    test("forces the lock when a save is stuck (B-359)", async () => {
        const { source } = createSource({ saveRunning: true });
        await lockVaultSource(source, 50);
        expect(source.status).toBe("locked");
        expect(source.lock).toHaveBeenLastCalledWith({ force: true });
        expect(mockLogWarn).toHaveBeenCalled();
    });

    test("waits for the lock itself once it has started", async () => {
        const { source, finishSave } = createSource({ saveRunning: true });
        // Like core: the source is pending while the lock runs
        source.status = "pending";
        const locking = lockVaultSource(source, 20);
        setTimeout(finishSave, 60);
        await locking;
        expect(source.status).toBe("locked");
        expect(source.lock).toHaveBeenCalledTimes(1);
    });

    test("passes on a lock that fails", async () => {
        const { source } = createSource({ saveRunning: false });
        source.lock.mockImplementationOnce(async () => {
            throw new Error("Failed locking source");
        });
        await expect(lockVaultSource(source, 50)).rejects.toThrow("Failed locking source");
    });
});
