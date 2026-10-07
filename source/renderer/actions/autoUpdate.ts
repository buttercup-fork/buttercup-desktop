import { ipcRenderer } from "../library/ipcRenderer";

export async function toggleAutoUpdate(enabled: boolean): Promise<void> {
    await ipcRenderer.invoke("toggle-auto-update", enabled);
}
