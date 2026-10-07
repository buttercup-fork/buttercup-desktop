import path from "node:path";
import { pathToFileURL } from "node:url";
import { app, Menu, shell, type WebContents } from "electron";
import { buildEditMenuTemplate } from "../library/editMenu";
import { isAppURL, isSafeExternalURL } from "../library/navigation";
import { getRootProjectPath } from "../library/paths";
import { logInfo, logWarn } from "../library/log";

export function getAppPageURL(): string {
    return pathToFileURL(path.join(getRootProjectPath(), "build/renderer/index.html")).href;
}

/**
 * Open a link in the user's browser or mail client. Only http(s) and
 * mailto links are passed on (see isSafeExternalURL).
 * @param url The URL to open
 */
export function openExternalSafely(url: string): void {
    if (!isSafeExternalURL(url)) {
        logWarn(`Refused to open external URL with an unsupported scheme: ${url}`);
        return;
    }
    logInfo(`Opening external URL: ${url}`);
    shell.openExternal(url);
}

// Sign-in windows (see auth3rdParty) have to follow the provider's pages, and the
// redirect back to its own address, which is where the token arrives. They have no
// Node access (sandboxed, no integration), so the guard below leaves them alone.
const __signInContents = new WeakSet<WebContents>();

/**
 * Let a sign-in window navigate freely instead of keeping it on the app's page
 * @param contents The sign-in window's contents
 */
export function allowSignInNavigation(contents: WebContents): void {
    __signInContents.add(contents);
}

/**
 * Keep every window on the app's own page (#1238). The renderer runs with
 * Node integration, so a remote or local page loaded in it would get full
 * access to the system. Links that try to leave are opened in the browser
 * instead (http, https and mailto only), and <webview> tags are refused.
 */
export function guardNavigation(): void {
    app.on("web-contents-created", (_, contents) => {
        contents.on("will-navigate", (event) => {
            if (__signInContents.has(contents)) return;
            if (isAppURL(event.url, getAppPageURL())) return;
            event.preventDefault();
            logWarn(`Blocked navigation away from the app: ${event.url}`);
            openExternalSafely(event.url);
        });
        contents.on("will-redirect", (event) => {
            if (__signInContents.has(contents)) return;
            if (isAppURL(event.url, getAppPageURL())) return;
            event.preventDefault();
            logWarn(`Blocked redirect away from the app: ${event.url}`);
        });
        contents.on("will-attach-webview", (event) => {
            event.preventDefault();
            logWarn("Blocked a webview from attaching");
        });
        contents.setWindowOpenHandler(({ url }) => {
            openExternalSafely(url);
            return { action: "deny" };
        });
        contents.on("context-menu", (_, params) => {
            const template = buildEditMenuTemplate(params);
            if (template.length > 0) {
                Menu.buildFromTemplate(template).popup();
            }
        });
    });
}
