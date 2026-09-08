import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { app } from "electron";
import { logErr, logInfo, logWarn } from "../library/log";
import { BUTTERCUP_PROTOCOL } from "../symbols";

const SCHEME = BUTTERCUP_PROTOCOL.replace("://", "");
const DESKTOP_FILE_NAME = `${SCHEME}.desktop`;
const MIME_TYPE = `x-scheme-handler/${SCHEME}`;

function runQuiet(command: string, args: Array<string>): Promise<void> {
    return new Promise((resolve) => {
        execFile(command, args, (err) => {
            if (err) {
                logWarn(`Desktop integration command failed (${command}): ${err.message}`);
            }
            resolve();
        });
    });
}

function buildDesktopEntry(execPath: string): string {
    // Double-quote the exec path per the Desktop Entry spec so paths containing
    // spaces still work; JSON.stringify escapes embedded quotes and backslashes.
    const execLine = `${JSON.stringify(execPath)} %U`;
    return (
        [
            "[Desktop Entry]",
            "Type=Application",
            `Name=${app.getName()}`,
            "Comment=A free and open-source password management application",
            `Exec=${execLine}`,
            "Icon=buttercup",
            "Terminal=false",
            "Categories=Utility;Security;",
            `MimeType=${MIME_TYPE};`,
            "StartupWMClass=Buttercup",
            "X-Buttercup-Generated=true"
        ].join("\n") + "\n"
    );
}

/**
 * Register the custom URL scheme handler on Linux when running as an AppImage.
 *
 * When Buttercup runs from a bare AppImage (no AppImageLauncher), nothing
 * installs a .desktop file, so the desktop environment has no handler for
 * `codekunde-buttercup://` URLs and Google Drive / protocol auth callbacks are
 * silently dropped (buttercup/buttercup-desktop#987). Electron's
 * `setAsDefaultProtocolClient` only shells out to `xdg-settings`, which needs an
 * existing .desktop file, so it can't fix this on its own. Here we write a
 * minimal .desktop file pointing back at the running AppImage and register it as
 * the scheme handler via `xdg-mime`.
 *
 * Native packages (deb/rpm/pacman) ship their own .desktop file and are skipped.
 */
export async function ensureLinuxProtocolHandler(): Promise<void> {
    if (process.platform !== "linux") return;
    const appImagePath = process.env.APPIMAGE;
    if (!appImagePath) {
        logInfo("Not running as AppImage: leaving URL scheme registration to the system package");
        return;
    }
    const applicationsDir = path.join(os.homedir(), ".local", "share", "applications");
    const desktopFilePath = path.join(applicationsDir, DESKTOP_FILE_NAME);
    const desktopEntry = buildDesktopEntry(appImagePath);
    try {
        let existing: string | null = null;
        try {
            existing = await fs.readFile(desktopFilePath, "utf8");
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        }
        if (existing !== desktopEntry) {
            await fs.mkdir(applicationsDir, { recursive: true });
            await fs.writeFile(desktopFilePath, desktopEntry, "utf8");
            logInfo(`Wrote URL scheme handler desktop entry: ${desktopFilePath}`);
            await runQuiet("update-desktop-database", [applicationsDir]);
        } else {
            logInfo("URL scheme handler desktop entry already up to date");
        }
        await runQuiet("xdg-mime", ["default", DESKTOP_FILE_NAME, MIME_TYPE]);
    } catch (err) {
        logErr("Failed registering Linux URL scheme handler", err);
    }
}
