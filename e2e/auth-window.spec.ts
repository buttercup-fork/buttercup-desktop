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

    test.beforeAll(async () => {
        server = createServer((req, res) => {
            if (req.url === "/start") {
                res.writeHead(302, { Location: "/done?access_token=tok123&state=x" });
                res.end();
            } else if (req.url === "/start-link") {
                // A page with a link on to the redirect address, like the provider's last step
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end('<a id="go" href="/done#access_token=tok456">Continue</a>');
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
    });

    const authenticate = (url: string) =>
        launched.window.evaluate(
            ({ url }) => {
                const { ipcRenderer } = require("electron");
                return ipcRenderer.invoke(
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

    test("only opens http and https pages", async () => {
        await expect(authenticate("file:///c:/windows/win.ini")).rejects.toThrow(/http or https/);
    });
});
