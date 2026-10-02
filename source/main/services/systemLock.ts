import { powerMonitor } from "electron";
import { getConfigValue } from "./config";
import { getUnlockedSourcesCount, lockAllSources } from "./buttercup";
import { logErr, logInfo } from "../library/log";
import type { Preferences } from "../types";

async function lockVaultsFor(reason: string) {
    const preferences: Preferences = await getConfigValue("preferences");
    if (!preferences.lockVaultsOnSystemLock || getUnlockedSourcesCount() === 0) return;
    logInfo(`Locking vaults: ${reason}`);
    try {
        await lockAllSources();
    } catch (err) {
        logErr(`Failed locking vaults (${reason})`, err);
    }
}

/**
 * Lock all vaults when the screen locks or the computer goes to sleep
 * (#1160). Electron reports a screen lock on Windows and macOS only; sleep
 * is reported on every platform.
 */
export function startSystemLockWatcher() {
    powerMonitor.on("lock-screen", () => lockVaultsFor("screen locked"));
    powerMonitor.on("suspend", () => lockVaultsFor("system going to sleep"));
}
