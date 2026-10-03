import { VaultSourceID, VaultSourceStatus } from "buttercup";
import {
    changeSourceMasterPassword,
    exportSourceEncrypted,
    getSourceStatus,
    testSourceMasterPassword
} from "./buttercup";
import { writePasswordChangeBackup } from "./backup";
import { disableSourceBiometricUnlock, replaceSourceBiometricPassword } from "./biometrics";
import { logErr, logInfo } from "../library/log";
import { ChangeMasterPasswordResult } from "../types";

/**
 * Change a vault's master password (#1046). Writes a backup of the vault, still
 * encrypted with the current password, before changing anything.
 */
export async function changeVaultMasterPassword(
    sourceID: VaultSourceID,
    currentPassword: string,
    newPassword: string
): Promise<ChangeMasterPasswordResult> {
    if (getSourceStatus(sourceID) !== VaultSourceStatus.Unlocked) {
        return { ok: false, reason: "not-unlocked" };
    }
    if (!(await testSourceMasterPassword(sourceID, currentPassword))) {
        return { ok: false, reason: "invalid-password" };
    }
    if (!newPassword || newPassword === currentPassword) {
        return { ok: false, reason: "same-password" };
    }
    const backup = await exportSourceEncrypted(sourceID, currentPassword);
    const backupPath = await writePasswordChangeBackup(sourceID, backup);
    await changeSourceMasterPassword(sourceID, currentPassword, newPassword);
    logInfo(`Master password changed for source: ${sourceID}`);
    let biometrics: "none" | "removed" | "updated" = "none";
    try {
        biometrics = (await replaceSourceBiometricPassword(sourceID, newPassword))
            ? "updated"
            : "none";
    } catch (err) {
        // The keychain still holds the old password: remove it rather than leave
        // biometric unlock failing
        logErr(`Failed replacing biometric password for source: ${sourceID}`, err);
        await disableSourceBiometricUnlock(sourceID).catch((err2) =>
            logErr(`Failed removing biometric password for source: ${sourceID}`, err2)
        );
        biometrics = "removed";
    }
    return { ok: true, backupPath, biometrics };
}
