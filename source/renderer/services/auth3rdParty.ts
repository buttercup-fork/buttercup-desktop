import { BrowserWindow } from "@electron/remote";
import { logInfo } from "../library/log";

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

export async function authenticate(authURL: string, matchRegex: RegExp): Promise<string | null> {
    const currentWindow = BrowserWindow.getFocusedWindow();
    logInfo(`Starting 3rd party authentication procedure: ${authURL}`);
    return new Promise<string>((resolve) => {
        let foundToken = null;
        let settled = false;
        // A unique, non-persistent session partition. Without this the auth
        // window shares the app's session, so once one account is connected the
        // provider silently reuses that login and there's no way to pick a
        // different account (buttercup/buttercup-desktop#1314). A fresh session
        // each time means the provider always asks which account to use.
        const partition = `auth-3rd-party-${Date.now()}`;
        const authWin = new BrowserWindow({
            parent: currentWindow,
            show: false,
            alwaysOnTop: true,
            webPreferences: {
                nodeIntegration: false,
                webSecurity: false,
                sandbox: true,
                partition
            }
        });
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
