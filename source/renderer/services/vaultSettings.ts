import { VaultSourceID } from "buttercup";
import { ipcRenderer } from "../library/ipcRenderer";
import { ChangeMasterPasswordResult, VaultSettingsLocal } from "../types";

export async function changeMasterPassword(
    sourceID: VaultSourceID,
    currentPassword: string,
    newPassword: string
): Promise<ChangeMasterPasswordResult> {
    return ipcRenderer.invoke(
        "change-source-master-password",
        sourceID,
        currentPassword,
        newPassword
    );
}

export async function getVaultSettings(sourceID: VaultSourceID): Promise<VaultSettingsLocal> {
    const settings = await ipcRenderer.invoke("get-vault-settings", sourceID);
    return settings || null;
}

export async function saveVaultSettings(
    sourceID: VaultSourceID,
    settings: VaultSettingsLocal
): Promise<void> {
    await ipcRenderer.invoke("set-vault-settings", sourceID, settings);
}
