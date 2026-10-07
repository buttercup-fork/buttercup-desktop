import { ipcRenderer } from "../library/ipcRenderer";

export function openLinkExternally(link: string) {
    ipcRenderer.invoke("open-link", link);
}
