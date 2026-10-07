import { ipcRenderer } from "../library/ipcRenderer";
import { AppEnvironmentFlags } from "../types";

export async function getAppEnvironmentFlags() {
    const payload: AppEnvironmentFlags = await ipcRenderer.invoke("get-app-environment");
    return payload;
}
