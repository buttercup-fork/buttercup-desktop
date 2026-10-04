import { dialog, MessageBoxOptions } from "electron";
import { Credentials, VaultSource, VaultSourceStatus } from "buttercup";
import { writeDamagedVaultBackup } from "./backup";
import { getMainWindow } from "./windows";
import { logErr, logInfo } from "../library/log";
import { t } from "../../shared/i18n/trans";

async function showMessageBox(options: MessageBoxOptions) {
    const win = getMainWindow();
    return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
}

/**
 * Offer to replace a damaged vault file with the copy core keeps from the last
 * time the vault was opened or saved on this computer (#1233). The copy is
 * opened first, so a wrong password fails as usual before anything is asked.
 * @returns True if the copy was restored and the vault is unlocked, false if
 *  there is no copy or the user declined
 */
export async function offerOfflineCopyRestore(
    source: VaultSource,
    password: string
): Promise<boolean> {
    if (!(await source.checkOfflineCopy())) return false;
    await source.unlock(Credentials.fromPassword(password), {
        loadOfflineCopy: true,
        storeOfflineCopy: false
    });
    const isFile = source.type === "file";
    const { response } = await showMessageBox({
        type: "warning",
        title: t("dialog.restore-offline-copy.title"),
        message: t("dialog.restore-offline-copy.message", {
            name: source.name,
            interpolation: { escapeValue: false }
        }),
        detail: t(
            isFile
                ? "dialog.restore-offline-copy.detail-file"
                : "dialog.restore-offline-copy.detail-remote"
        ),
        buttons: [
            t("dialog.restore-offline-copy.restore"),
            t("dialog.restore-offline-copy.cancel")
        ],
        defaultId: 0,
        cancelId: 1,
        noLink: true
    });
    if (response !== 0) {
        await source.lock();
        return false;
    }
    try {
        if (isFile) {
            await writeDamagedVaultBackup(source.id, (source._datasource as any).path);
        }
        await source.restoreOfflineCopy();
    } catch (err) {
        logErr(`Failed restoring the last saved copy of source: ${source.id}`, err);
        if (source.status === VaultSourceStatus.Unlocked) {
            await source.lock();
        }
        throw new Error(
            t("error.vault-restore-failed", {
                message: (err as Error).message,
                interpolation: { escapeValue: false }
            })
        );
    }
    logInfo(`Restored the last saved copy of source: ${source.id}`);
    return true;
}
