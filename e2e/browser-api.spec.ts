import { request } from "http";
import { connect } from "net";
import { networkInterfaces } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

const BROWSER_API_PORT = 12822;
const EXTENSION_ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const PAIRING_REQUEST = JSON.stringify({ client: "browser", purpose: "vaults-access", rev: 1 });
const WEB_PAGE = "https://evil.example.com";

interface Reply {
    status: number;
    headers: Record<string, string | string[] | undefined>;
}

/** `fetch` cannot set the Host header, so use the http module */
function send(
    method: string,
    path: string,
    headers: Record<string, string> = {},
    body?: string
): Promise<Reply> {
    return new Promise((resolve, reject) => {
        const req = request(
            { host: "127.0.0.1", port: BROWSER_API_PORT, path, method, headers },
            (res) => {
                res.resume();
                res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
            }
        );
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
    });
}

function canConnect(host: string): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = connect({ host, port: BROWSER_API_PORT });
        socket.on("connect", () => {
            socket.destroy();
            resolve(true);
        });
        socket.on("error", () => resolve(false));
    });
}

/**
 * The Browser API (used by the browser extension) answers on this computer only,
 * and only to requests that are not from a web page. Needs port 12822 free: quit
 * the installed Buttercup first.
 */
test.describe("browser API", () => {
    let launched: LaunchedApp;

    const pairingCodeShown = () =>
        launched.window.evaluate(() => /\b[A-Z0-9]{12}\b/.test(document.body.innerText));

    test.beforeAll(async () => {
        launched = await launchApp();
        await launched.window.evaluate(async () => {
            const ipcRenderer = (window as any).buttercupIPC;
            const preferences = await new Promise<any>((resolve) => {
                ipcRenderer.once("get-preferences:reply", (_, payload) =>
                    resolve(JSON.parse(payload))
                );
                ipcRenderer.send("get-preferences");
            });
            ipcRenderer.send(
                "write-preferences",
                JSON.stringify({ preferences: { ...preferences, fileHostEnabled: true } })
            );
        });
        await expect
            .poll(
                () =>
                    send("GET", "/v1/entries").then(
                        (reply) => reply.status,
                        () => 0
                    ),
                { timeout: 20000 }
            )
            .toBeGreaterThan(0);
    });

    test.afterAll(async () => {
        await launched?.close();
    });

    test("reaches the routes for a caller without an Origin", async () => {
        // 401: the request got past the guard and was refused for having no client key
        expect(
            (await send("GET", "/v1/entries", { Host: `localhost:${BROWSER_API_PORT}` })).status
        ).toBe(401);
    });

    test("answers the preflight of a browser extension, for that extension only", async () => {
        const reply = await send("OPTIONS", "/v1/auth/request", {
            Origin: EXTENSION_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"
        });
        expect(reply.status).toBe(204);
        expect(reply.headers["access-control-allow-origin"]).toBe(EXTENSION_ORIGIN);
    });

    test("refuses a web page's preflight and request", async () => {
        const preflight = await send("OPTIONS", "/v1/auth/request", {
            Origin: WEB_PAGE,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"
        });
        expect(preflight.status).toBe(403);
        expect(preflight.headers["access-control-allow-origin"]).toBeUndefined();
        const post = await send(
            "POST",
            "/v1/auth/request",
            { Origin: WEB_PAGE, "Content-Type": "application/json" },
            PAIRING_REQUEST
        );
        expect(post.status).toBe(403);
        expect(post.headers["access-control-allow-origin"]).toBeUndefined();
    });

    test("refuses another Host name", async () => {
        expect((await send("GET", "/v1/entries", { Host: "evil.example.com" })).status).toBe(403);
    });

    test("shows no pairing code for a web page, and one for the extension", async () => {
        await send(
            "POST",
            "/v1/auth/request",
            { Origin: WEB_PAGE, "Content-Type": "application/json" },
            PAIRING_REQUEST
        );
        expect(await pairingCodeShown()).toBe(false);
        const reply = await send(
            "POST",
            "/v1/auth/request",
            { Origin: EXTENSION_ORIGIN, "Content-Type": "application/json" },
            PAIRING_REQUEST
        );
        expect(reply.status).toBe(200);
        await expect.poll(pairingCodeShown).toBe(true);
    });

    test("is not reachable from other machines", async () => {
        const lan = Object.values(networkInterfaces())
            .flat()
            .find((iface) => iface?.family === "IPv4" && !iface.internal);
        test.skip(!lan, "no network address on this machine");
        expect(await canConnect("127.0.0.1")).toBe(true);
        expect(await canConnect(lan!.address)).toBe(false);
    });
});
