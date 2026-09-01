import { app } from "electron";
import { isOSX } from "../../shared/library/platform";
import { disableUpdates } from "./update";

let __autostarted = false,
    __showMainWindow = true;

export function processLaunchConfiguration() {
    const cl = app.commandLine;
    // Deprecated switch
    if (cl.hasSwitch("no-window")) {
        __showMainWindow = false;
    }
    if (cl.hasSwitch("hidden")) {
        __showMainWindow = false;
    }
    const loginItemSettings = app.getLoginItemSettings();
    if (isOSX() && loginItemSettings.wasOpenedAtLogin) {
        __autostarted = true;
    }
    // `wasOpenedAsHidden` is macOS-only and no longer in Electron's type
    // definitions, but is still provided at runtime.
    if (isOSX() && (loginItemSettings as { wasOpenedAsHidden?: boolean }).wasOpenedAsHidden) {
        __showMainWindow = false;
    }
    if (cl.hasSwitch("autostart")) {
        __autostarted = true;
    }
    if (cl.hasSwitch("no-update")) {
        disableUpdates();
    }
}

export function shouldShowMainWindow(): boolean {
    return __showMainWindow;
}

export function wasAutostarted(): boolean {
    return __autostarted;
}
