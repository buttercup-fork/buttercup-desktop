import fs from "fs";
import { dialog } from "electron";
import { VaultSourceID } from "buttercup";
import { exportVault, getSourceDescription } from "./buttercup";
import { getMainWindow } from "./windows";
import { t } from "../../shared/i18n/trans";
import { logErr, logInfo } from "../library/log";

const UTF8_BOM = "\uFEFF";
const OWNER_ONLY = 0o600;

/**
 * Write a file that only its owner can read (B-682). An existing file keeps its
 * old mode when it is opened, so the mode is set before anything is written.
 * On Windows the mode has no effect: the file gets the folder's permissions.
 */
async function writeOwnerOnlyFile(filePath: string, data: string): Promise<void> {
    const handle = await fs.promises.open(filePath, "w", OWNER_ONLY);
    try {
        if (process.platform !== "win32") {
            await handle.chmod(OWNER_ONLY);
        }
        await handle.writeFile(data, "utf8");
    } finally {
        await handle.close();
    }
}

export async function exportVaultSource(sourceID: VaultSourceID): Promise<void> {
    const mainWindow = getMainWindow();
    const sourceDetails = getSourceDescription(sourceID);
    // The CSV holds every password in plain text: say so before a file is chosen
    // (the save dialog's own message text is shown on macOS only)
    const warning = await dialog.showMessageBox(mainWindow, {
        type: "warning",
        title: t("dialog.export-warning.title"),
        message: t("dialog.export-warning.message"),
        buttons: [t("dialog.export-warning.continue"), t("dialog.export-warning.cancel")],
        defaultId: 1,
        cancelId: 1
    });
    if (warning.response !== 0) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
        title: t("dialog.export-file-chooser.title", { name: sourceDetails.name }),
        buttonLabel: t("dialog.export-file-chooser.submit-button"),
        filters: [
            {
                name: "Buttercup CSV",
                extensions: ["csv"]
            }
        ],
        properties: ["createDirectory", "showOverwriteConfirmation"]
    });
    if (result.canceled) return null;
    try {
        const csvData = await exportVault(sourceID);
        logInfo(`Export source (${sourceID}) to CSV file: ${result.filePath}`);
        // A UTF-8 BOM first, or Excel reads the file in the local code page and
        // shows accented characters wrong ("Accès" as "AccÃ¨s", #749). The importer
        // skips it.
        await writeOwnerOnlyFile(result.filePath, `${UTF8_BOM}${csvData}`);
    } catch (err) {
        logErr("Export failed", err);
        // The toast shows text, not HTML: unescaped, or a path shows "&#39;" for its quotes
        mainWindow.webContents.send(
            "notify-error",
            t("notification.error.export-failed", {
                error: err.message,
                interpolation: { escapeValue: false }
            })
        );
        return null;
    }
    mainWindow.webContents.send(
        "notify-success",
        t("notification.export-success", { name: sourceDetails.name })
    );
}
