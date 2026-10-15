import { request } from "http";
import { connect } from "net";
import { networkInterfaces } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

const FILE_HOST_PORT = 12821;

interface Reply {
    status: number;
    body: string;
}

/** `fetch` cannot set the Host header, so use the http module */
function get(path: string, headers: Record<string, string> = {}): Promise<Reply> {
    return new Promise((resolve, reject) => {
        const req = request(
            { host: "127.0.0.1", port: FILE_HOST_PORT, path, method: "GET", headers },
            (res) => {
                let body = "";
                res.on("data", (chunk) => (body += chunk));
                res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
            }
        );
        req.on("error", reject);
        req.end();
    });
}

function canConnect(host: string): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = connect({ host, port: FILE_HOST_PORT });
        socket.on("connect", () => {
            socket.destroy();
            resolve(true);
        });
        socket.on("error", () => resolve(false));
    });
}

/**
 * The secure file host (used by the browser extension) answers on this machine
 * only, and only to requests that are not from a web page. Needs port 12821 free:
 * quit the installed Buttercup first.
 */
test.describe("secure file host", () => {
    let launched: LaunchedApp;

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
                    get("/").then(
                        (reply) => reply.status,
                        () => 0
                    ),
                { timeout: 20000 }
            )
            .toBe(200);
    });

    test.afterAll(async () => {
        await launched?.close();
    });

    test("identifies itself to a client on this machine", async () => {
        const reply = await get("/", { Host: `localhost:${FILE_HOST_PORT}` });
        expect(reply.status).toBe(200);
        expect(JSON.parse(reply.body)).toMatchObject({ type: "secure-file-host", status: "ok" });
    });

    test("answers a browser extension origin", async () => {
        const reply = await get("/", { Origin: "chrome-extension://abcdefghijklmnop" });
        expect(reply.status).toBe(200);
    });

    test("refuses a web page, and another Host name", async () => {
        expect((await get("/", { Origin: "https://evil.example.com" })).status).toBe(403);
        expect((await get("/", { Host: "evil.example.com" })).status).toBe(403);
    });

    test("does not start pairing for a web page", async () => {
        expect((await get("/connect", { Origin: "https://evil.example.com" })).status).toBe(403);
        // Still ready for the real extension
        expect(JSON.parse((await get("/")).body)).toMatchObject({ ready: true });
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
