import { ipcRenderer } from "electron";

export type VaultFileForUpload = { contents: string; name: string } | { error: string };

export async function chooseVaultFileForUpload(): Promise<VaultFileForUpload | null> {
    return ipcRenderer.invoke("choose-vault-file-upload");
}
