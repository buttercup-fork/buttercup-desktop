import { dialog, MessageBoxOptions } from "electron";
import { Credentials, VaultSource } from "buttercup";
import { getMainWindow } from "./windows";
import { logInfo } from "../library/log";
import { t } from "../../shared/i18n/trans";

async function showMessageBox(options: MessageBoxOptions) {
    const win = getMainWindow();
    return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
}

/**
 * Ask whether a vault whose WebDAV address uses plain http may connect, and
 * unlock it if so (B-684). Core refuses such addresses unless allowed, and
 * stores the choice in the source's credentials once it is allowed.
 * @returns True if the user allowed it and the vault is unlocked, false if
 *  the user declined
 */
export async function offerInsecureWebDAVUnlock(
    source: VaultSource,
    password: string
): Promise<boolean> {
    const { response } = await showMessageBox({
        type: "warning",
        title: t("dialog.insecure-webdav.title"),
        message: t("dialog.insecure-webdav.message", {
            name: source.name,
            interpolation: { escapeValue: false }
        }),
        detail: t("dialog.insecure-webdav.detail"),
        buttons: [t("dialog.insecure-webdav.allow"), t("dialog.insecure-webdav.cancel")],
        defaultId: 1,
        cancelId: 1,
        noLink: true
    });
    if (response !== 0) {
        logInfo(`Unencrypted WebDAV connection declined for source: ${source.id}`);
        return false;
    }
    // A variable, not a literal: desktop's core lock predates the option
    // (core 8, B-684), and its type has no allowInsecureEndpoint yet
    const options = { allowInsecureEndpoint: true, loadOfflineCopy: false };
    await source.unlock(Credentials.fromPassword(password), options);
    logInfo(`Unencrypted WebDAV connection allowed for source: ${source.id}`);
    return true;
}
