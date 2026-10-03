import { dialog, MessageBoxOptions } from "electron";
import { VaultSourceID } from "buttercup";
import {
    getSourceDescriptions,
    getUnsavedSourceIDs,
    lockAllSources,
    lockSource,
    saveSource,
    waitForRunningSaves
} from "../services/buttercup";
import { getMainWindow } from "../services/windows";
import { logErr, logInfo, logWarn } from "../library/log";
import { t } from "../../shared/i18n/trans";

// How long a last save attempt may take before quitting or locking. A stalled
// remote would otherwise keep the app open, or a vault unlocked, forever.
const SAVE_BEFORE_CLOSE_TIMEOUT = 30 * 1000;
const SAVE_BEFORE_AUTO_LOCK_TIMEOUT = 15 * 1000;
// A save that is still running usually finishes quickly: wait for it before asking
const RUNNING_SAVE_WAIT = 5 * 1000;

type CloseAction = "lock" | "quit";

function getSourceNames(sourceIDs: Array<VaultSourceID>): string {
    const sources = getSourceDescriptions();
    return sourceIDs
        .map((sourceID) => sources.find((source) => source.id === sourceID)?.name ?? sourceID)
        .join(", ");
}

async function showMessageBox(options: MessageBoxOptions) {
    const win = getMainWindow();
    return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
}

/**
 * Save the given vaults once more. Resolves with the ones that still failed
 * (or didn't finish in time), and their errors.
 */
async function trySaving(
    sourceIDs: Array<VaultSourceID>,
    timeout: number
): Promise<Array<{ sourceID: VaultSourceID; error: Error }>> {
    const results = await Promise.all(
        sourceIDs.map(async (sourceID) => {
            let timer: NodeJS.Timeout;
            try {
                await Promise.race([
                    saveSource(sourceID),
                    new Promise((_, reject) => {
                        timer = setTimeout(
                            () => reject(new Error(t("dialog.unsaved-changes.timeout"))),
                            timeout
                        );
                    })
                ]);
                return null;
            } catch (error) {
                logWarn(`Saving '${sourceID}' failed`, error);
                return { sourceID, error };
            } finally {
                clearTimeout(timer);
            }
        })
    );
    return results.filter(Boolean);
}

/**
 * Before quitting or locking by hand: if vaults hold changes that couldn't be
 * saved, ask whether to save them first, go ahead anyway, or stop (#1230).
 * @returns True if the quit/lock should go ahead
 */
export async function confirmUnsavedChanges(
    action: CloseAction,
    sourceIDs: Array<VaultSourceID> | null = null
): Promise<boolean> {
    const getUnsaved = () =>
        getUnsavedSourceIDs().filter((sourceID) => !sourceIDs || sourceIDs.includes(sourceID));
    if (getUnsaved().length === 0) return true;
    await waitForRunningSaves(getUnsaved(), RUNNING_SAVE_WAIT);
    const unsaved = getUnsaved();
    if (unsaved.length === 0) return true;
    const names = getSourceNames(unsaved);
    logInfo(`Unsaved changes before ${action}: ${unsaved.join(", ")}`);
    const { response } = await showMessageBox({
        type: "warning",
        title: t("dialog.unsaved-changes.title"),
        message: t(`dialog.unsaved-changes.message-${action}`),
        detail: t("dialog.unsaved-changes.detail", { names }),
        buttons: [
            t(`dialog.unsaved-changes.save-${action}`),
            t(`dialog.unsaved-changes.${action}-anyway`),
            t("dialog.unsaved-changes.cancel")
        ],
        defaultId: 0,
        cancelId: 2,
        noLink: true
    });
    if (response === 2) return false;
    if (response === 1) {
        logWarn(`Discarding unsaved changes (${action}): ${unsaved.join(", ")}`);
        return true;
    }
    const failed = await trySaving(unsaved, SAVE_BEFORE_CLOSE_TIMEOUT);
    if (failed.length === 0) return true;
    await showMessageBox({
        type: "error",
        title: t("dialog.unsaved-changes.title"),
        message: t(`dialog.unsaved-changes.save-failed-${action}`),
        detail: failed
            .map(({ sourceID, error }) => `${getSourceNames([sourceID])}: ${error.message}`)
            .join("\n"),
        noLink: true
    });
    return false;
}

/**
 * Lock one vault by hand, asking first if it has unsaved changes.
 * @returns True if the vault was locked
 */
export async function lockSourceAfterConfirming(sourceID: VaultSourceID): Promise<boolean> {
    if (!(await confirmUnsavedChanges("lock", [sourceID]))) return false;
    await lockSource(sourceID);
    return true;
}

/**
 * Lock all vaults by hand, asking first if any has unsaved changes.
 */
export async function lockAllSourcesAfterConfirming(): Promise<void> {
    if (!(await confirmUnsavedChanges("lock"))) return;
    await lockAllSources();
}

/**
 * Automatic lock (idle timer, screen lock, sleep): nobody may be there to
 * answer, so try saving unsaved changes once more and then lock anyway. If
 * changes were lost, say so for when the user comes back.
 */
export async function lockAllSourcesAfterSaving(): Promise<void> {
    const unsaved = getUnsavedSourceIDs();
    const failed =
        unsaved.length > 0 ? await trySaving(unsaved, SAVE_BEFORE_AUTO_LOCK_TIMEOUT) : [];
    await lockAllSources();
    if (failed.length === 0) return;
    const names = getSourceNames(failed.map(({ sourceID }) => sourceID));
    logErr(`Locked with unsaved changes, which are lost: ${names}`);
    // Not awaited: the user may be away
    showMessageBox({
        type: "error",
        title: t("dialog.unsaved-changes.title"),
        message: t("dialog.unsaved-changes.lost-on-auto-lock", { names }),
        detail: failed
            .map(({ sourceID, error }) => `${getSourceNames([sourceID])}: ${error.message}`)
            .join("\n"),
        noLink: true
    }).catch((err) => logErr("Failed showing lost-changes message", err));
}
