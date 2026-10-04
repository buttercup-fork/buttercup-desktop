import path from "path";
import { app, dialog } from "electron";
import { UpdateInfo, autoUpdater } from "electron-updater";
import isDev from "electron-is-dev";
import debounce from "debounce-promise";
import ms from "ms";
import { clearDelayedInterval, setDelayedInterval } from "delayable-setinterval";
import { getMainWindow } from "./windows";
import { logErr, logInfo, logWarn } from "../library/log";
import { fileExists } from "../library/file";
import { isUpdateFeedUnavailable } from "../library/updateErrors";
import { getConfigValue } from "./config";
import { openExternalSafely } from "./navigation";
import { t } from "../../shared/i18n/trans";
import { UpdateProgressInfo } from "../types";

// Where to get the installer by hand when the update can't install itself
const RELEASES_URL = "https://github.com/codekunde/buttercup-desktop/releases/latest";
// How long after "install" a failure to start the installer can still arrive
const INSTALL_WATCH_TIME = ms("10s");
const UPDATE_AUTO_CHECK = ms("30m");

export const checkForUpdate = debounce(checkForUpdateInternal, 2500);

let __eventListenersAttached = false,
    __currentUpdate: UpdateInfo = null,
    __readyUpdate: UpdateInfo = null,
    __updateCheckTimer: string = null,
    __updateErrored: boolean = false,
    __updateFeedWarned: boolean = false,
    __updateMuted: boolean = false,
    __updatesDisabled: boolean = false;

function attachEventListeners(updater = autoUpdater) {
    updater.on("error", (err: Error) => {
        __updateErrored = true;
        if (err?.message === "net::ERR_INTERNET_DISCONNECTED") {
            logInfo("Updates: Update failed due to no internet connection");
            return;
        }
        if (isUpdateFeedUnavailable(err)) {
            warnUpdateFeedUnavailable(err);
            return;
        }
        logErr("Updates: Error processing update", err);
        const win = getMainWindow();
        if (win) {
            win.webContents.send("update-error", err.message);
        }
    });
    updater.on("download-progress", (progress: UpdateProgressInfo) => {
        const win = getMainWindow();
        if (win) {
            win.webContents.send("update-progress", JSON.stringify(progress));
        }
    });
    updater.on("update-available", (updateInfo: UpdateInfo) => {
        logInfo(`Updates: Update available: ${updateInfo.version} (${updateInfo.releaseDate})`);
        if (__updateMuted) {
            logInfo("Updates: Updates muted: will not notify");
            return;
        }
        const win = getMainWindow();
        if (win) {
            win.webContents.send("update-available", JSON.stringify(updateInfo));
        }
    });
    updater.on("update-not-available", () => {
        logInfo("Updates: No update available");
    });
    updater.on("update-downloaded", (updateInfo: UpdateInfo) => {
        logInfo(`Updates: Updated build downloaded: ${updateInfo.version}`);
        const win = getMainWindow();
        if (win) {
            win.webContents.send("update-progress", JSON.stringify(null));
        }
        if (__updateErrored) {
            logWarn("Updates: Skipping update-ready notification due to preview error");
            return;
        }
        __readyUpdate = updateInfo;
        __currentUpdate = null;
        if (win) {
            win.webContents.send("update-downloaded", JSON.stringify(updateInfo));
        }
    });
}

async function checkForUpdateInternal() {
    if (__updatesDisabled) return;
    if (!__eventListenersAttached) {
        __eventListenersAttached = true;
        attachEventListeners();
    }
    __currentUpdate = null;
    __readyUpdate = null;
    __updateErrored = false;
    const prefs = await getConfigValue("preferences");
    logInfo(
        `Updates: Using pre-release channel for updates: ${prefs.prereleaseUpdates ? "yes" : "no"}`
    );
    autoUpdater.allowPrerelease = prefs.prereleaseUpdates;
    autoUpdater.autoDownload = false;
    autoUpdater.setFeedURL({
        provider: "github",
        owner: "codekunde",
        repo: "buttercup-desktop"
    });
    if (isDev) {
        const hasDevConfig = await hasDevUpdate();
        if (!hasDevConfig) {
            logInfo("Updates: Will not check for updates: In dev mode with no dev-app-update.yml");
            return;
        }
    }
    logInfo("Checking for updates");
    try {
        await autoUpdater.checkForUpdates();
    } catch (err) {
        // Already handled by the "error" listener
        if (isUpdateFeedUnavailable(err)) return;
        logErr(`Updates: Update check failed: ${err.message}`);
        logErr(err);
    }
}

export function disableUpdates(): void {
    __updatesDisabled = true;
    logInfo("Updates: Updates have been manually disabled");
}

export function getCurrentUpdate(): UpdateInfo {
    return !__updateMuted && __currentUpdate && !__updatesDisabled ? __currentUpdate : null;
}

export function getReadyUpdate(): UpdateInfo {
    return __readyUpdate;
}

async function hasDevUpdate(): Promise<boolean> {
    return fileExists(path.join(app.getAppPath(), "dev-app-update.yml"));
}

export function installUpdate() {
    // quitAndInstall() starts the installer and quits right away. When the
    // installer can't be started (#690: blocked by Windows or a virus scanner,
    // file gone, no permission), the error arrives just before the quit and the
    // app would close without updating. Stay open and offer the download page.
    let installError: Error | null = null;
    const onError = (err: Error) => {
        installError = err;
    };
    const onBeforeQuit = (event: Electron.Event) => {
        if (!installError) return;
        event.preventDefault();
        stopWatching();
        showInstallFailed(installError).catch((err) =>
            logErr("Updates: Failed showing the install error", err)
        );
    };
    const stopWatching = () => {
        autoUpdater.off("error", onError);
        app.off("before-quit", onBeforeQuit);
    };
    autoUpdater.on("error", onError);
    app.on("before-quit", onBeforeQuit);
    autoUpdater.quitAndInstall();
    if (!(autoUpdater as unknown as { quitAndInstallCalled: boolean }).quitAndInstallCalled) {
        // Nothing to install (already reported through the "error" event), no quit coming
        stopWatching();
        return;
    }
    setTimeout(stopWatching, INSTALL_WATCH_TIME);
}

async function showInstallFailed(err: Error): Promise<void> {
    logErr("Updates: Couldn't start the installer", err);
    const win = getMainWindow();
    const options: Electron.MessageBoxOptions = {
        type: "error",
        title: t("update.install-failed.title"),
        message: t("update.install-failed.message"),
        detail: err.message,
        buttons: [
            t("update.install-failed.download-button"),
            t("update.install-failed.close-button")
        ],
        defaultId: 0,
        cancelId: 1,
        noLink: true
    };
    const { response } = win
        ? await dialog.showMessageBox(win, options)
        : await dialog.showMessageBox(options);
    if (response === 0) {
        openExternalSafely(RELEASES_URL);
    }
}

export function muteUpdate() {
    logInfo("Updates: Update notification muted");
    __updateMuted = true;
}

export async function startUpdate(): Promise<void> {
    await autoUpdater.downloadUpdate();
}

export async function startUpdateWatcher(): Promise<void> {
    await checkForUpdate();
    __updateCheckTimer = setDelayedInterval(checkForUpdate, UPDATE_AUTO_CHECK);
}

export function stopUpdateWatcher(): void {
    clearDelayedInterval(__updateCheckTimer);
}

// The check repeats every 30 minutes: log a missing release feed once per run,
// without the error toast, instead of an error each time
function warnUpdateFeedUnavailable(err: Error) {
    if (__updateFeedWarned) return;
    __updateFeedWarned = true;
    logWarn(
        `Updates: Release feed not available, no updates to check: ${err.message.split("\n")[0]}`
    );
}
