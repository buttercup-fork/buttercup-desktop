import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { app, powerMonitor } from "electron";
import { getConfigValue } from "./config";
import { getUnlockedSourcesCount } from "./buttercup";
import { lockAllSourcesAfterSaving } from "../actions/unsaved";
import { logErr, logInfo, logWarn } from "../library/log";
import { createScreenLockParser } from "../library/screenLock";
import type { Preferences } from "../types";

async function lockVaultsFor(reason: string) {
    const preferences: Preferences = await getConfigValue("preferences");
    if (!preferences.lockVaultsOnSystemLock || getUnlockedSourcesCount() === 0) return;
    logInfo(`Locking vaults: ${reason}`);
    try {
        await lockAllSourcesAfterSaving();
    } catch (err) {
        logErr(`Failed locking vaults (${reason})`, err);
    }
}

const DBUS_RESTART_DELAY = 5000;
const DBUS_MAX_RESTARTS = 5;

/**
 * Linux: Electron doesn't report a screen lock, so listen on the D-Bus session
 * bus for the screen saver's ActiveChanged signal (B-9) through the system's
 * `dbus-monitor`. Without that program (package dbus-bin) the screen lock isn't
 * noticed, and only sleep locks the vaults.
 */
function watchLinuxScreenLock() {
    let child: ChildProcess | null = null;
    let restarts = 0;
    let stopped = false;
    const parse = createScreenLockParser((locked) => {
        if (locked) lockVaultsFor("screen locked");
    });
    const start = () => {
        child = spawn("dbus-monitor", ["--session", "type='signal',member='ActiveChanged'"], {
            stdio: ["ignore", "pipe", "ignore"]
        });
        createInterface({ input: child.stdout }).on("line", parse);
        child.on("error", (err: NodeJS.ErrnoException) => {
            stopped = true;
            logWarn(
                err.code === "ENOENT"
                    ? "Locking vaults with the screen isn't available: dbus-monitor isn't installed (package dbus-bin)"
                    : `Locking vaults with the screen isn't available: ${err.message}`
            );
        });
        child.on("exit", (code) => {
            child = null;
            if (stopped) return;
            if (restarts >= DBUS_MAX_RESTARTS) {
                logWarn(
                    `dbus-monitor keeps stopping (exit ${code}): not watching the screen lock any more`
                );
                return;
            }
            restarts += 1;
            logWarn(`dbus-monitor stopped (exit ${code}): starting it again`);
            setTimeout(start, DBUS_RESTART_DELAY);
        });
    };
    app.on("will-quit", () => {
        stopped = true;
        child?.kill();
    });
    start();
    logInfo("Watching the screen lock through D-Bus");
}

/**
 * Lock all vaults when the screen locks or the computer goes to sleep
 * (#1160). Electron reports a screen lock on Windows and macOS only; on Linux
 * it comes from D-Bus (see watchLinuxScreenLock). Sleep is reported on every
 * platform.
 */
export function startSystemLockWatcher() {
    powerMonitor.on("lock-screen", () => lockVaultsFor("screen locked"));
    powerMonitor.on("suspend", () => lockVaultsFor("system going to sleep"));
    if (process.platform === "linux") {
        watchLinuxScreenLock();
    }
}
