import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * Third-party sign-in (Dropbox) opens its own window from the main process and
 * hands the token from the redirect back to the page.
 */
test.describe("third-party sign-in window", () => {
    let launched: LaunchedApp;
    let server: Server;
    let base: string;
    // The redirect address on another site, like the provider's registered
    // redirect page: it must never be loaded, because the token is in its address
    let landing: Server;
    let landingBase: string;
    let landingRequests: string[] = [];

    test.beforeAll(async () => {
        landing = createServer((req, res) => {
            landingRequests.push(req.url ?? "");
            // A page that reads the token from its own address and sends it home
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(
                "<script>new Image().src = '/leak?' + encodeURIComponent(location.hash);</script>"
            );
        });
        await new Promise<void>((resolve) => landing.listen(0, "127.0.0.1", resolve));
        landingBase = `http://127.0.0.1:${(landing.address() as AddressInfo).port}`;
        server = createServer((req, res) => {
            if (req.url === "/start") {
                res.writeHead(302, { Location: "/done?access_token=tok123&state=x" });
                res.end();
            } else if (req.url === "/start-link") {
                // A page with a link on to the redirect address, like the provider's last step
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end('<a id="go" href="/done#access_token=tok456">Continue</a>');
            } else if (req.url === "/start-elsewhere") {
                res.writeHead(302, {
                    Location: `${landingBase}/landing#access_token=tok-redirect`
                });
                res.end();
            } else if (req.url === "/start-elsewhere-script") {
                // The provider's page sends the browser on with a script
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(
                    `<script>location.href = ${JSON.stringify(`${landingBase}/landing#access_token=tok-script`)};</script>`
                );
            } else {
                res.writeHead(200).end("ok");
            }
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        launched = await launchApp();
    });

    test.afterAll(async () => {
        await launched?.close();
        server.close();
        landing.close();
    });

    test.beforeEach(() => {
        landingRequests = [];
    });

    const authenticate = (url: string) =>
        launched.window.evaluate(
            ({ url }) => {
                return (window as any).buttercupIPC.invoke(
                    "authenticate-3rd-party",
                    url,
                    "access_token=([^&]*)",
                    ""
                );
            },
            { url }
        );

    test("returns the token from the redirect and closes its window", async () => {
        const token = await authenticate(`${base}/start`);
        expect(token).toBe("tok123");
        const windows = await launched.app.evaluate(
            ({ BrowserWindow }) => BrowserWindow.getAllWindows().length
        );
        expect(windows).toBe(1);
    });

    test("follows a link on the page to the redirect address", async () => {
        // The app's guard that keeps windows on its own page used to block this and open
        // the address (token included) in the user's browser instead, so a real sign-in
        // carried on there and never reached the app
        await launched.app.evaluate(({ shell }) => {
            (globalThis as any).__opened = [];
            shell.openExternal = async (url: string) => {
                (globalThis as any).__opened.push(url);
            };
        });
        const pending = authenticate(`${base}/start-link`);
        // Click the link in the sign-in window, as the user would
        await expect
            .poll(() =>
                launched.app.evaluate(({ BrowserWindow }) => {
                    const win = BrowserWindow.getAllWindows().find((w) =>
                        w.webContents.getURL().includes("/start-link")
                    );
                    if (!win) return false;
                    // A real click (a script's click isn't a navigation by the user)
                    for (const type of ["mouseDown", "mouseUp"] as const) {
                        win.webContents.sendInputEvent({
                            type,
                            x: 20,
                            y: 20,
                            button: "left",
                            clickCount: 1
                        });
                    }
                    return true;
                })
            )
            .toBe(true);
        expect(await pending).toBe("tok456");
        // Nothing was sent to the user's browser on the way
        expect(await launched.app.evaluate(() => (globalThis as any).__opened)).toEqual([]);
    });

    test("does not load the redirect page that carries the token (server redirect)", async () => {
        const token = await authenticate(`${base}/start-elsewhere`);
        expect(token).toBe("tok-redirect");
        // Give a page that did start loading time to arrive and report back
        await new Promise((resolve) => setTimeout(resolve, 1500));
        expect(landingRequests).toEqual([]);
    });

    test("does not load the redirect page that carries the token (script)", async () => {
        const token = await authenticate(`${base}/start-elsewhere-script`);
        expect(token).toBe("tok-script");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        expect(landingRequests).toEqual([]);
    });

    test("only opens http and https pages", async () => {
        await expect(authenticate("file:///c:/windows/win.ini")).rejects.toThrow(/http or https/);
    });
});
