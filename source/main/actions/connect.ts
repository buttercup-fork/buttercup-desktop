import path from "path";
import { BrowserWindow, dialog } from "electron";
import { Credentials, VaultSourceID } from "buttercup";
import { addVault, findSourceByLocationKey } from "../services/buttercup";
import { logInfo, logWarn } from "../library/log";
import { isVaultFile } from "../services/vaultFile";
import { getVaultLocationKey } from "../library/vaultLocation";
import { t } from "../../shared/i18n/trans";
import { AddVaultPayload, SourceType } from "../types";

export async function addVaultFromPayload(payload: AddVaultPayload): Promise<VaultSourceID> {
    let credentials: Credentials, name: string;
    switch (payload.datasourceConfig.type) {
        case SourceType.GoogleDrive:
            credentials = Credentials.fromDatasource(
                payload.datasourceConfig,
                payload.masterPassword
            );
            name = payload.fileNameOverride || payload.datasourceConfig.fileID;
            break;
        case SourceType.Dropbox:
        /* falls-through */
        case SourceType.WebDAV:
        /* falls-through */
        case SourceType.File: {
            credentials = Credentials.fromDatasource(
                payload.datasourceConfig,
                payload.masterPassword
            );
            name = path.basename(payload.datasourceConfig.path).replace(/\.bcup$/i, "");
            break;
        }
        default:
            throw new Error(`Unsupported vault type: ${payload.datasourceConfig.type}`);
    }
    // The same vault added twice showed up in two tabs, and creating a "new"
    // vault over one already in the list replaced its file (#1172)
    const locationKey = getVaultLocationKey(payload.datasourceConfig);
    const existing = locationKey ? findSourceByLocationKey(locationKey) : null;
    if (existing) {
        logInfo(`Not adding vault "${name}": already added as ${existing.id}`);
        throw new Error(
            t("error.vault-already-added", {
                name: existing.name,
                interpolation: { escapeValue: false }
            })
        );
    }
    logInfo(
        `Adding vault "${name}" (${payload.datasourceConfig.type}) (new = ${
            payload.createNew ? "yes" : "no"
        })`
    );
    const sourceID = await addVault(
        name,
        credentials,
        Credentials.fromPassword(payload.masterPassword),
        payload.datasourceConfig.type,
        payload.createNew,
        locationKey
    );
    logInfo(`Added vault "${name}" (${sourceID})`);
    return sourceID;
}

export async function showExistingFileVaultDialog(win: BrowserWindow): Promise<string> {
    const result = await dialog.showOpenDialog(win, {
        title: t("dialog.file-vault.add-existing.title"),
        buttonLabel: t("dialog.file-vault.add-existing.confirm-button"),
        // Vault files may have another extension, or none (#1371)
        filters: [
            { name: t("dialog.file-vault.add-existing.bcup-filter"), extensions: ["bcup"] },
            { name: t("dialog.file-vault.add-existing.all-files-filter"), extensions: ["*"] }
        ],
        properties: ["openFile"]
    });
    const [vaultPath] = result.filePaths;
    if (!vaultPath) return null;
    if (!(await isVaultFile(vaultPath))) {
        logWarn(`Not adding ${vaultPath}: not a Buttercup vault`);
        await dialog.showMessageBox(win, {
            type: "warning",
            title: t("dialog.file-vault.add-existing.title"),
            message: t("dialog.file-vault.add-existing.not-a-vault", {
                name: path.basename(vaultPath),
                interpolation: { escapeValue: false }
            })
        });
        return null;
    }
    return vaultPath;
}

export async function showNewFileVaultDialog(win: BrowserWindow): Promise<string> {
    const result = await dialog.showSaveDialog(win, {
        title: t("dialog.file-vault.add-new.title"),
        buttonLabel: t("dialog.file-vault.add-new.confirm-button"),
        filters: [{ name: t("dialog.file-vault.add-new.bcup-filter"), extensions: ["bcup"] }],
        properties: ["createDirectory", "dontAddToRecent", "showOverwriteConfirmation"]
    });
    let vaultPath = result.filePath;
    if (!vaultPath) return null;
    if (/\.bcup$/i.test(vaultPath) === false) {
        vaultPath = `${vaultPath}.bcup`;
    }
    return vaultPath;
}
