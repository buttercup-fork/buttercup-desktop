import { TimeoutError, withTimeout } from "./timeout";

const never = () => new Promise<never>(() => {});
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

test("resolves with the promise value when it settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok");
});

test("rejects with the original error when the promise rejects in time", async () => {
    const boom = new Error("boom");
    await expect(withTimeout(Promise.reject(boom), 1000)).rejects.toBe(boom);
});

test("rejects with a TimeoutError once the deadline passes", async () => {
    const result = withTimeout(never(), 1, { message: "Timed out - no response" });
    await expect(result).rejects.toBeInstanceOf(TimeoutError);
    await expect(result).rejects.toThrow("Timed out - no response");
});

test("routes a late resolution to onLateSettle instead of resolving", async () => {
    let resolvePending: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
        resolvePending = resolve;
    });
    const calls: Array<{ value?: string; error?: any }> = [];
    const result = withTimeout(pending, 1, { onLateSettle: (r) => calls.push(r) });
    await expect(result).rejects.toBeInstanceOf(TimeoutError);
    resolvePending("late");
    await flush();
    expect(calls).toEqual([{ value: "late" }]);
});

test("does not fire onLateSettle when the promise settles in time", async () => {
    const calls: Array<unknown> = [];
    await withTimeout(Promise.resolve("ok"), 1000, { onLateSettle: (r) => calls.push(r) });
    await flush();
    expect(calls).toHaveLength(0);
});
