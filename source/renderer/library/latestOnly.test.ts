import { latestOnly } from "./latestOnly";

// B-668: a slower, older generation must not replace a newer result

function deferred<T>() {
    let resolve: (value: T) => void;
    let reject: (err: Error) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

test("positive control: plain promises apply results in the order they finish", async () => {
    // What PasswordGenerator did: every result sets the state
    let shown = "";
    const older = deferred<string>();
    const newer = deferred<string>();
    older.promise.then((value) => (shown = value));
    newer.promise.then((value) => (shown = value));
    newer.resolve("newer");
    await flush();
    older.resolve("older");
    await flush();
    expect(shown).toBe("older");
});

test("an older result that finishes last is dropped", async () => {
    const onlyLatest = latestOnly<string>();
    let shown = "";
    const older = deferred<string>();
    const newer = deferred<string>();
    onlyLatest(older.promise).then((value) => (shown = value));
    onlyLatest(newer.promise).then((value) => (shown = value));
    newer.resolve("newer");
    await flush();
    older.resolve("older");
    await flush();
    expect(shown).toBe("newer");
});

test("an older failure that finishes last is dropped too", async () => {
    const onlyLatest = latestOnly<string>();
    const seen: Array<string> = [];
    const older = deferred<string>();
    const newer = deferred<string>();
    onlyLatest(older.promise).then(
        (value) => seen.push(value),
        (err) => seen.push(`error: ${err.message}`)
    );
    onlyLatest(newer.promise).then((value) => seen.push(value));
    newer.resolve("newer");
    await flush();
    older.reject(new Error("too limited"));
    await flush();
    expect(seen).toEqual(["newer"]);
});

test("the latest call settles like its promise, value or error", async () => {
    const onlyLatest = latestOnly<string>();
    await expect(onlyLatest(Promise.resolve("ok"))).resolves.toBe("ok");
    const boom = new Error("boom");
    await expect(onlyLatest(Promise.reject(boom))).rejects.toBe(boom);
});

test("results in order are all handed on", async () => {
    const onlyLatest = latestOnly<string>();
    expect(await onlyLatest(Promise.resolve("first"))).toBe("first");
    expect(await onlyLatest(Promise.resolve("second"))).toBe("second");
});
