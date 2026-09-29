import { LoopbackAuthSession, startLoopbackAuth } from "./googleLoopback";

let session: LoopbackAuthSession | null = null;

afterEach(() => {
    session?.close();
    session = null;
});

test("listens on a loopback redirect URI", async () => {
    session = await startLoopbackAuth(5000);
    expect(session.redirectURI).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(session.state).toMatch(/^[a-f0-9]{32}$/);
});

test("resolves the code when Google adds extra parameters such as iss", async () => {
    session = await startLoopbackAuth(5000);
    const code = "4/0Abc_def-ghi";
    const res = await fetch(
        `${session.redirectURI}/?state=${session.state}&iss=${encodeURIComponent(
            "https://accounts.google.com"
        )}&code=${encodeURIComponent(code)}&scope=email`
    );
    expect(res.status).toBe(200);
    await expect(session.waitForCode()).resolves.toBe(code);
});

test("ignores requests with the wrong state and keeps waiting", async () => {
    session = await startLoopbackAuth(5000);
    const bad = await fetch(`${session.redirectURI}/?state=nope&code=evil`);
    expect(bad.status).toBe(400);
    const good = await fetch(`${session.redirectURI}/?state=${session.state}&code=real`);
    expect(good.status).toBe(200);
    await expect(session.waitForCode()).resolves.toBe("real");
});

test("rejects when Google returns an error", async () => {
    session = await startLoopbackAuth(5000);
    const res = await fetch(`${session.redirectURI}/?state=${session.state}&error=access_denied`);
    expect(res.status).toBe(400);
    await expect(session.waitForCode()).rejects.toThrow(/access_denied/);
});

test("rejects after the timeout", async () => {
    session = await startLoopbackAuth(50);
    await expect(session.waitForCode()).rejects.toThrow(/Timed-out/);
});

test("rejects and stops listening when closed", async () => {
    session = await startLoopbackAuth(5000);
    const { redirectURI } = session;
    session.close();
    await expect(session.waitForCode()).rejects.toThrow(/cancelled/);
    await expect(fetch(`${redirectURI}/?state=x&code=y`)).rejects.toThrow();
});
