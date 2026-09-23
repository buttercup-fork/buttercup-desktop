import { clipboard, dialog, nativeImage } from "electron";
import { t } from "../../shared/i18n/trans";
import { getMainWindow } from "./windows";

/**
 * Reads the current clipboard contents as an image data URL, for QR decoding
 * in the renderer. Most 2FA setup pages only offer a QR code, so the easiest
 * way to get it into Buttercup is a screenshot straight to the clipboard
 * (e.g. Win+Shift+S / Cmd+Shift+4-to-clipboard) followed by this.
 */
export async function readClipboardQRImage(): Promise<string | null> {
    const items = await clipboard.read();
    for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) continue;
        const blob = (await item.getType(imageType)) as Blob;
        const buffer = Buffer.from(await blob.arrayBuffer());
        return `data:${imageType};base64,${buffer.toString("base64")}`;
    }
    return null;
}

/**
 * Falls back to a file picker when the clipboard has no image - e.g. the
 * user saved the QR code as a file instead of screenshotting it.
 */
export async function chooseQRImageFile(): Promise<string | null> {
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
        title: t("dialog.otp-qr-chooser.title"),
        buttonLabel: t("dialog.otp-qr-chooser.submit-button"),
        filters: [
            {
                name: t("dialog.otp-qr-chooser.filter-name"),
                extensions: ["png", "jpg", "jpeg", "gif", "bmp", "webp"]
            }
        ],
        properties: ["openFile"]
    });
    const [imagePath] = result.filePaths;
    if (!imagePath) return null;
    const image = nativeImage.createFromPath(imagePath);
    if (image.isEmpty()) return null;
    return image.toDataURL();
}
