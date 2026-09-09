import { ipcRenderer } from "electron";
import { Intent } from "@blueprintjs/core";
import { VaultFacade, VaultSourceID } from "buttercup";
import { Layerr } from "layerr";
import { setSaving } from "../state/app";
import { createProgressNotification } from "../services/notifications";
import { logInfo, logWarn } from "../library/log";
import { withTimeout } from "../library/timeout";
import { t } from "../../shared/i18n/trans";
import { ICON_UPLOAD } from "../../shared/symbols";

// A stalled remote (e.g. a WebDAV server that accepts the connection but never
// responds) leaves `ipcRenderer.invoke` pending forever, so the `finally` below
// never runs and every button stays disabled until the app is restarted
// (buttercup/buttercup-desktop#1077). Cap the wait and surface an error instead.
export const SAVE_TIMEOUT = 90 * 1000;

export async function saveVaultFacade(sourceID: VaultSourceID, vaultFacade: VaultFacade) {
    const progNotification = createProgressNotification(ICON_UPLOAD, 100);
    setSaving(true);
    logInfo(`Saving vault facade: ${sourceID}`);
    try {
        await withTimeout(
            ipcRenderer.invoke("save-vault-facade", sourceID, vaultFacade),
            SAVE_TIMEOUT,
            {
                message: t("notification.error.vault-save-timeout"),
                onLateSettle: ({ error }) => {
                    if (error) {
                        logWarn(`Save of '${sourceID}' failed after timing out`, error);
                    } else {
                        logInfo(`Save of '${sourceID}' completed after timing out`);
                    }
                }
            }
        );
        logInfo(`Saved vault facade: ${sourceID}`);
        progNotification.clear(t("notification.vault-saved"), Intent.SUCCESS);
    } catch (err) {
        progNotification.clear(
            `${t("notification.error.vault-save-failed")}: ${
                err.message || t("notification.error.unknown-error")
            }`,
            Intent.DANGER,
            10000
        );
        throw new Layerr(err, "Failed saving vault");
    } finally {
        setSaving(false);
    }
}
