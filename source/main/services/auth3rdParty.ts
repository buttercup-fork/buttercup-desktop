import { BrowserWindow } from "electron";
import { logInfo } from "../library/log";
import { allowSignInNavigation } from "./navigation";

// The default Electron user-agent contains "Electron/<version>" and the app
// name; some providers (Google, when signing into Dropbox with a Google
// account) reject that with "this browser or app may not be secure"
// (buttercup/buttercup-desktop#888). Present as a plain desktop Chrome instead,
// pinned to the Chromium version actually bundled with this build.
function desktopUserAgent(): string {
    const chrome = process.versions.chrome || "120.0.0.0";
    const platformToken =
        process.platform === "darwin"
            ? "Macintosh; Intel Mac OS X 10_15_7"
            : process.platform === "win32"
              ? "Windows NT 10.0; Win64; x64"
              : "X11; Linux x86_64";
    return `Mozilla/5.0 (${platformToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Safari/537.36`;
}

/**
 * Open a sign-in page in its own window and wait for the redirect that carries
 * the token. Runs in the main process: the renderer only gets the token back.
 * @param parent The window the sign-in window belongs to
 * @param authURL The provider's sign-in page (http or https)
 * @param matchSource Source of the regular expression the redirect URL is
 *  matched against; its first group is the token
 * @param matchFlags Flags for the regular expression
 * @returns The token, or null if the window was closed without one
 */
export async function authenticate(
    parent: BrowserWindow | null,
    authURL: string,
    matchSource: string,
    matchFlags = ""
): Promise<string | null> {
    if (!/^https?:\/\//i.test(authURL)) {
        throw new Error("Sign-in pages must be http or https");
    }
    const matchRegex = new RegExp(matchSource, matchFlags);
    logInfo(`Starting 3rd party authentication procedure: ${authURL}`);
    return new Promise<string | null>((resolve) => {
        let foundToken: string | null = null;
        let settled = false;
        // A unique, non-persistent session partition. Without this the auth
        // window shares the app's session, so once one account is connected the
        // provider silently reuses that login and there's no way to pick a
        // different account (buttercup/buttercup-desktop#1314). A fresh session
        // each time means the provider always asks which account to use.
        const partition = `auth-3rd-party-${Date.now()}`;
        const authWin = new BrowserWindow({
            parent: parent ?? undefined,
            show: false,
            alwaysOnTop: true,
            webPreferences: {
                nodeIntegration: false,
                webSecurity: false,
                sandbox: true,
                partition
            }
        });
        allowSignInNavigation(authWin.webContents);
        authWin.webContents.setUserAgent(desktopUserAgent());

        authWin.loadURL(authURL);
        authWin.show();

        const navigateCB = (url: string) => {
            const match = url.match(matchRegex);
            if (match !== null && match.length > 0) {
                foundToken = match[1];
                authWin.close();
            }
        };
        const finish = () => {
            if (settled) return;
            settled = true;
            if (foundToken) {
                logInfo("Completing 3rd party authentication with token");
                return resolve(foundToken);
            }
            logInfo("Completing 3rd party authentication without token");
            resolve(null);
        };

        authWin.webContents.on("did-start-navigation", (e, url) => navigateCB(url));
        authWin.webContents.on("will-redirect", (e, url) => navigateCB(url));
        // A link or button on the page that leads to the redirect address
        authWin.webContents.on("will-navigate", (e, url) => navigateCB(url));
        authWin.on("close", () => {
            // Wipe the throwaway session so no auth cookies / tokens linger.
            try {
                authWin.webContents.session.clearStorageData().catch(() => {});
            } catch (err) {
                // window already tearing down
            }
            finish();
        });
        authWin.on("closed", finish);
    });
}
