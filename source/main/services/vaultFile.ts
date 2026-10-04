import path from "node:path";
import fs from "node:fs/promises";
import { dialog } from "electron";
import { getMainWindow } from "./windows";
import { t } from "../../shared/i18n/trans";
import { logInfo, logWarn } from "../library/log";

// Every encrypted Buttercup vault file starts with this signature
const VAULT_SIGNATURE = "b~>buttercup/";

export type VaultFileForUpload = { contents: string; name: string } | { error: string };

/**
 * Whether the file starts with the vault signature. Only reads that much: the
 * open dialogs offer "All files" (#1371), so it may be any file, of any size.
 */
export async function isVaultFile(filePath: string): Promise<boolean> {
    const file = await fs.open(filePath, "r");
    try {
        const signature = Buffer.alloc(VAULT_SIGNATURE.length);
        const { bytesRead } = await file.read(signature, 0, signature.length, 0);
        return signature.toString("utf8", 0, bytesRead) === VAULT_SIGNATURE;
    } finally {
        await file.close();
    }
}

/**
 * Let the user pick a local vault file to upload to a cloud service
 * (Google Drive "Upload Vault"). Resolves null when cancelled, and an
 * error message when the file isn't a Buttercup vault.
 */
export async function chooseVaultFileForUpload(): Promise<VaultFileForUpload | null> {
    const result = await dialog.showOpenDialog(getMainWindow(), {
        title: t("dialog.vault-upload-chooser.title"),
        buttonLabel: t("dialog.vault-upload-chooser.submit-button"),
        // Vault files may have another extension, or none (#1371)
        filters: [
            { name: t("dialog.vault-upload-chooser.filter-name"), extensions: ["bcup"] },
            { name: t("dialog.vault-upload-chooser.all-files-filter"), extensions: ["*"] }
        ],
        properties: ["openFile"]
    });
    const [filePath] = result.filePaths;
    if (!filePath) {
        logInfo("Vault upload: no file chosen");
        return null;
    }
    const contents = await fs.readFile(filePath, "utf8");
    if (!contents.startsWith(VAULT_SIGNATURE)) {
        logWarn(`Vault upload: refused ${filePath}, not a Buttercup vault`);
        return { error: t("dialog.vault-upload-chooser.not-a-vault") };
    }
    logInfo(`Vault upload: chose ${filePath}`);
    return { contents, name: path.basename(filePath) };
}
