import { ipcRenderer } from "../library/ipcRenderer";
import { AboutInfo, AboutLinkID } from "../types";

export async function copyAboutDetails(coreVersion: string): Promise<void> {
    await ipcRenderer.invoke("copy-about-details", coreVersion);
}

export async function getAboutInfo(): Promise<AboutInfo> {
    return ipcRenderer.invoke("get-about-info");
}

// The main process opens the link's fixed address: the window only names it
export async function openAboutLink(id: AboutLinkID): Promise<void> {
    await ipcRenderer.invoke("open-about-link", id);
}
