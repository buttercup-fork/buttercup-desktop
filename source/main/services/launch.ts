import path from "node:path";
import fs from "node:fs/promises";
import { app } from "electron";
import untildify from "untildify";
import { pathExists } from "path-exists";
import { isLinux } from "../../shared/library/platform";

const AUTOSTART_ARGS = ["--autostart"];
const LINUX_AUTOSTART_DIR = "~/.config/autostart";
const LINUX_DESKTOP = `
[Desktop Entry]
Type=Application
Version=1.0
Name={{APP_NAME}}
Comment={{APP_NAME}} startup script
Exec={{APP_PATH}} --autostart
StartupNotify=false
Terminal=false
`;

export async function setStartWithSession(enable: boolean): Promise<void> {
    if (isLinux()) {
        await setStartWithSessionLinux(enable);
    } else {
        await setStartWithSessionNative(enable);
    }
}

async function setStartWithSessionLinux(enable: boolean): Promise<void> {
    const autostartPath = path.join(untildify(LINUX_AUTOSTART_DIR), "buttercup.desktop");
    const isEnabled = await pathExists(autostartPath);
    let execPath = process.env?.APPIMAGE ? process.env.APPIMAGE : process.execPath;
    execPath = execPath.replace(/(\s+)/g, "\\$1");
    if (enable && !isEnabled) {
        const desktop = LINUX_DESKTOP.trim()
            .replace(/{{APP_NAME}}/g, "Buttercup")
            .replace(/{{APP_PATH}}/g, execPath);
        await fs.writeFile(autostartPath, desktop);
    } else if (!enable && isEnabled) {
        await fs.unlink(autostartPath);
    }
}

async function setStartWithSessionNative(enable: boolean): Promise<void> {
    // On Windows the login item only counts as ours when the path and args
    // match the ones it was registered with, so query and change it with the
    // same ones. Without them it always looked disabled and was never removed
    // (#1267). The portable exe runs from a new temp folder on every start, so
    // register the exe itself.
    const loginItem = {
        path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
        args: AUTOSTART_ARGS
    };
    const isEnabled = app.getLoginItemSettings(loginItem).openAtLogin;
    if (enable && !isEnabled) {
        app.setLoginItemSettings({
            ...loginItem,
            // `openAsHidden` is macOS-only and dropped from Electron's types.
            openAsHidden: true,
            openAtLogin: true
        } as Electron.Settings & { openAsHidden?: boolean });
    } else if (!enable && isEnabled) {
        app.setLoginItemSettings({
            ...loginItem,
            openAsHidden: false,
            openAtLogin: false
        } as Electron.Settings & { openAsHidden?: boolean });
    }
}
