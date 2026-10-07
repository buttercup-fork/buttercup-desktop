import { ipcRenderer } from "../library/ipcRenderer";

export async function readClipboardQRImage(): Promise<string | null> {
    return ipcRenderer.invoke("read-clipboard-qr-image");
}

export async function chooseQRImageFile(): Promise<string | null> {
    return ipcRenderer.invoke("choose-qr-image-file");
}
