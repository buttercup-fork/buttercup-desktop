import { logErr, logInfo } from "../library/log";
import { getUnlockedSourcesCount, lockAllSources } from "./buttercup";
import { getConfigValue } from "./config";

let __autoVaultLockTimeout: NodeJS.Timeout | null = null;
let __suspended = false;

/**
 * Suspend / resume auto-locking. Auto-lock is suspended while the user is
 * editing an entry so they can't be locked out mid-edit. Previously this was the
 * only thing that armed auto-lock at all (via the auto-update toggle, defaulting
 * to "off"), so the timer frequently never started - see
 * buttercup/buttercup-desktop#1033.
 */
export function setAutoLockSuspended(suspended: boolean): void {
    __suspended = suspended;
    void startAutoVaultLockTimer();
}

export async function startAutoVaultLockTimer(): Promise<void> {
    stopAutoVaultLockTimer();
    if (__suspended) return;
    if (getUnlockedSourcesCount() === 0) return;
    const { lockVaultsAfterTime } = await getConfigValue("preferences");
    if (!lockVaultsAfterTime) return;
    __autoVaultLockTimeout = setTimeout(() => {
        __autoVaultLockTimeout = null;
        if (getUnlockedSourcesCount() === 0) return;
        logInfo("Auto-lock timer elapsed - locking all vaults");
        lockAllSources().catch((err) => logErr("Auto-lock: failed to lock vaults", err));
    }, lockVaultsAfterTime * 1000);
}

export function stopAutoVaultLockTimer(): void {
    if (__autoVaultLockTimeout) {
        clearTimeout(__autoVaultLockTimeout);
        __autoVaultLockTimeout = null;
    }
}
