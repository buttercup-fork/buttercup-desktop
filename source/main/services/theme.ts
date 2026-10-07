import { BrowserWindow, nativeTheme } from "electron";
import { getConfigValue } from "./config";
import { logInfo } from "../library/log";
import { Preferences } from "../types";

export async function applyCurrentTheme(preferences?: Preferences) {
    const prefs: Preferences = preferences ? preferences : await getConfigValue("preferences");
    logInfo(`Applying theme source: ${prefs.uiTheme}`);
    nativeTheme.themeSource = prefs.uiTheme;
}

export function shouldUseDarkColors(): boolean {
    return nativeTheme.shouldUseDarkColors;
}

/**
 * Tell the windows when the colour scheme changes (the theme setting, or the
 * system's, when it follows that)
 */
export function watchThemeChanges() {
    nativeTheme.on("updated", () => {
        const dark = nativeTheme.shouldUseDarkColors;
        BrowserWindow.getAllWindows().forEach((win) => {
            if (!win.isDestroyed()) win.webContents.send("theme-updated", dark);
        });
    });
}
