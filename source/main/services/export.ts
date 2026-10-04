import fs from "fs";
import { dialog } from "electron";
import { VaultSourceID } from "buttercup";
import pify from "pify";
import { exportVault, getSourceDescription } from "./buttercup";
import { getMainWindow } from "./windows";
import { t } from "../../shared/i18n/trans";
import { logInfo } from "../library/log";

const writeFile = pify(fs.writeFile);

const UTF8_BOM = "\uFEFF";

export async function exportVaultSource(sourceID: VaultSourceID): Promise<void> {
    const mainWindow = getMainWindow();
    const sourceDetails = getSourceDescription(sourceID);
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
    const csvData = await exportVault(sourceID);
    logInfo(`Export source (${sourceID}) to CSV file: ${result.filePath}`);
    // A UTF-8 BOM first, or Excel reads the file in the local code page and
    // shows accented characters wrong ("Accès" as "AccÃ¨s", #749). The importer
    // skips it.
    await writeFile(result.filePath, `${UTF8_BOM}${csvData}`);
    mainWindow.webContents.send(
        "notify-success",
        t("notification.export-success", { name: sourceDetails.name })
    );
}
