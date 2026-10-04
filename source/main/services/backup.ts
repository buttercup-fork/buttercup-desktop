import path from "path";
import fs from "fs/promises";
import { VaultSource, VaultSourceID } from "buttercup";
import { logErr, logInfo } from "../library/log";
import { getVaultSettings } from "./config";
import { VAULTS_BACKUP_PATH } from "./storage";

const __removeListener: Record<VaultSourceID, () => void> = {};

export function attachSourceEncryptedListeners(source: VaultSource) {
    if (__removeListener[source.id]) {
        __removeListener[source.id]();
        delete __removeListener[source.id];
    }
    const handler = ({ content }) => {
        handleSourceSave(source.id, content).catch((err) => {
            logErr(`Failed processing backup for source: ${source.id}`, err);
            delete __removeListener[source.id];
        });
    };
    source._datasource.on("encryptedContent", handler);
    __removeListener[source.id] = () => source._datasource.off("encryptedContent", handler);
}

function getBackupRoot(sourceID: VaultSourceID, localBackupLocation: unknown): string {
    return typeof localBackupLocation === "string" && localBackupLocation
        ? path.resolve(VAULTS_BACKUP_PATH, path.join(localBackupLocation, sourceID))
        : path.join(VAULTS_BACKUP_PATH, sourceID);
}

function getBackupFilename(
    sourceID: VaultSourceID,
    type: "damaged" | "password-change" | "save"
): string {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");
    return `${type}_${year}-${month}-${day}_${hour}-${minute}-${second}_${date.getTime()}.bcup`;
}

async function handleSourceSave(sourceID: VaultSourceID, content: string): Promise<void> {
    // Get settings for source
    const vaultSettings = await getVaultSettings(sourceID);
    if (!vaultSettings.localBackup) return;
    // Calculate path
    const backupRoot = getBackupRoot(sourceID, vaultSettings.localBackupLocation);
    const backupPath = path.join(backupRoot, getBackupFilename(sourceID, "save"));
    // Create folders
    await fs.mkdir(backupRoot, {
        recursive: true
    });
    // Backup
    logInfo(`Backing up source: ${sourceID} => ${backupPath}`);
    await fs.writeFile(backupPath, content);
    logInfo(`Source backup complete: ${sourceID}`);
}

/**
 * Write a copy of the vault, still encrypted with the current password, before
 * the master password is changed. Written whether or not local backups are on.
 * @returns The path of the backup file
 */
export async function writePasswordChangeBackup(
    sourceID: VaultSourceID,
    content: string
): Promise<string> {
    const vaultSettings = await getVaultSettings(sourceID);
    const backupRoot = getBackupRoot(sourceID, vaultSettings.localBackupLocation);
    const backupPath = path.join(backupRoot, getBackupFilename(sourceID, "password-change"));
    await fs.mkdir(backupRoot, {
        recursive: true
    });
    logInfo(`Backing up source before password change: ${sourceID} => ${backupPath}`);
    await fs.writeFile(backupPath, content);
    return backupPath;
}

/**
 * Keep a copy of a damaged vault file before it is replaced by the last saved
 * copy (#1233). Written whether or not local backups are on.
 * @returns The path of the backup file
 */
export async function writeDamagedVaultBackup(
    sourceID: VaultSourceID,
    vaultPath: string
): Promise<string> {
    const vaultSettings = await getVaultSettings(sourceID);
    const backupRoot = getBackupRoot(sourceID, vaultSettings.localBackupLocation);
    const backupPath = path.join(backupRoot, getBackupFilename(sourceID, "damaged"));
    await fs.mkdir(backupRoot, {
        recursive: true
    });
    logInfo(`Backing up damaged vault file: ${sourceID} => ${backupPath}`);
    await fs.copyFile(vaultPath, backupPath);
    return backupPath;
}
