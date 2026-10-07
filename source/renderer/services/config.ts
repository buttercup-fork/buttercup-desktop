import { ipcRenderer } from "../library/ipcRenderer";
import { VaultSourceID } from "buttercup";

export async function getSelectedSource(): Promise<string> {
    const sourceID = await ipcRenderer.invoke("get-selected-source");
    return sourceID;
}

export async function setSelectedSource(sourceID: VaultSourceID): Promise<void> {
    await ipcRenderer.invoke("set-selected-source", sourceID);
}
