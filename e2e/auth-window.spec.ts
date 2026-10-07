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

    test("only opens http and https pages", async () => {
        await expect(authenticate("file:///c:/windows/win.ini")).rejects.toThrow(/http or https/);
    });
});
