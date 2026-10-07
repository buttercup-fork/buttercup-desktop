import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * The window's Content Security Policy (resources/renderer.html). The cloud
 * vault pages (Dropbox, Google Drive, WebDAV) make their requests from the
 * renderer, so requests to other servers have to stay allowed; a policy that
 * blocked them broke "Add Vault" for every cloud service.
 */
test.describe("content security policy", () => {
    let launched: LaunchedApp;
    let server: Server;
    let url: string;

    test.beforeAll(async () => {
        server = createServer((req, res) => {
            res.writeHead(200, { "Access-Control-Allow-Origin": "*" });
            res.end("hello");
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
        url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
        launched = await launchApp();
    });

    test.afterAll(async () => {
        await launched?.close();
        server.close();
    });

    test("the window can reach a server over http (WebDAV, cloud services)", async () => {
        const body = await launched.window.evaluate(async (target) => {
            const res = await fetch(target);
            return res.text();
        }, url);
        expect(body).toBe("hello");
    });

    test("an inline script added to the page does not run", async () => {
        const ran = await launched.window.evaluate(() => {
            (window as any).__injected = false;
            const script = document.createElement("script");
            script.textContent = "window.__injected = true;";
            document.body.appendChild(script);
            return (window as any).__injected;
        });
        expect(ran).toBe(false);
    });
});
