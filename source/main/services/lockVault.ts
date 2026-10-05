import { VaultSource, VaultSourceStatus } from "buttercup";
import { logWarn } from "../library/log";

// How long a lock may wait for a save or update that is still running. A
// stalled remote never answers, and the vault would stay unlocked for good.
const LOCK_WAIT = 5 * 1000;

/**
 * Lock a vault, waiting a while for a save or update that is still running
 * first. If it doesn't finish in time, lock anyway: it is dropped, and so
 * are unsaved changes (B-359). Callers ask or warn about those beforehand.
 */
export async function lockVaultSource(source: VaultSource, wait: number = LOCK_WAIT) {
    const locking = source.lock();
    let timer: NodeJS.Timeout;
    const finished = await Promise.race([
        locking.then(() => true),
        new Promise<boolean>((resolve) => {
            timer = setTimeout(() => resolve(false), wait);
        })
    ]).finally(() => clearTimeout(timer));
    if (finished) return;
    if (source.status !== VaultSourceStatus.Unlocked) {
        // The lock itself is running by now
        await locking;
        return;
    }
    logWarn(`Locking '${source.id}' without waiting for a save or update that is stuck`);
    // The waiting lock is dropped with the stuck change
    locking.catch(() => {});
    await source.lock({ force: true });
}
