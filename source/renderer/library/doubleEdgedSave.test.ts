import { createDoubleEdgedSaver } from "./doubleEdgedSave";

function deferred<T = void>() {
    let resolve: (value: T) => void;
    let reject: (err: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test("saves immediately on the first call", async () => {
    const calls: Array<string> = [];
    const save = createDoubleEdgedSaver<string, string>(async (key, payload) => {
        calls.push(`${key}:${payload}`);
    });
    await save("a", "1");
    expect(calls).toEqual(["a:1"]);
});

test("coalesces calls made while a save is in flight into a single trailing save", async () => {
    const calls: Array<string> = [];
    let gate = deferred<void>();
    const save = createDoubleEdgedSaver<string, string>(async (key, payload) => {
        calls.push(`${key}:${payload}`);
        await gate.promise;
    });

    const p1 = save("a", "1");
    // Two more updates arrive while the first save is still in flight
    const p2 = save("a", "2");
    const p3 = save("a", "3");

    expect(calls).toEqual(["a:1"]); // only the first save has started

    gate.resolve();
    await p1;
    // The trailing coalesced save (with the latest payload) should now run
    await flush();

    gate = deferred<void>();
    gate.resolve();
    await p2;
    await p3;

    expect(calls).toEqual(["a:1", "a:3"]); // "2" was superseded by "3", never saved on its own
});

test("all coalesced callers resolve once the trailing save completes", async () => {
    let gate = deferred<void>();
    const save = createDoubleEdgedSaver<string, string>(async () => {
        await gate.promise;
    });

    const p1 = save("a", "1");
    const p2 = save("a", "2");
    const p3 = save("a", "3");

    gate.resolve();
    await p1;
    await flush();
    gate = deferred<void>();
    gate.resolve();

    await expect(p2).resolves.toBeUndefined();
    await expect(p3).resolves.toBeUndefined();
});

test("rejects coalesced callers when the trailing save fails", async () => {
    let callCount = 0;
    let gate = deferred<void>();
    const boom = new Error("boom");
    const save = createDoubleEdgedSaver<string, string>(async () => {
        callCount += 1;
        await gate.promise;
        if (callCount === 2) {
            throw boom;
        }
    });

    const p1 = save("a", "1");
    const p2 = save("a", "2");
    // Attach the rejection expectation immediately so it's the handler that
    // "claims" the promise, rather than racing the reject() call below.
    const p2Assertion = expect(p2).rejects.toBe(boom);

    gate.resolve();
    await p1;
    await flush();
    gate = deferred<void>();
    gate.resolve();

    await p2Assertion;
});

test("tracks separate keys independently", async () => {
    const calls: Array<string> = [];
    const gates: Record<string, ReturnType<typeof deferred>> = {
        a: deferred<void>(),
        b: deferred<void>()
    };
    const save = createDoubleEdgedSaver<string, string>(async (key, payload) => {
        calls.push(`${key}:${payload}`);
        await gates[key].promise;
    });

    const pA = save("a", "1");
    const pB = save("b", "1");

    expect(calls).toEqual(["a:1", "b:1"]); // both start immediately, independently

    gates.a.resolve();
    gates.b.resolve();
    await pA;
    await pB;
});

test("a save after the previous one fully completed starts immediately again", async () => {
    const calls: Array<string> = [];
    const save = createDoubleEdgedSaver<string, string>(async (key, payload) => {
        calls.push(`${key}:${payload}`);
    });

    await save("a", "1");
    await save("a", "2");

    expect(calls).toEqual(["a:1", "a:2"]);
});
