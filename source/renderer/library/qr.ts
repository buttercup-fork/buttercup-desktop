import jsQR from "jsqr";

/**
 * Decodes a QR code from an image data URL (as produced by Electron's
 * nativeImage.toDataURL(), from a clipboard screenshot or a chosen file).
 * Returns the decoded text, or null if no QR code was found in the image.
 */
export function decodeQRFromDataURL(dataURL: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Failed acquiring canvas context"));
                return;
            }
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const result = jsQR(imageData.data, imageData.width, imageData.height);
            resolve(result ? result.data : null);
        };
        img.onerror = () => reject(new Error("Failed loading image"));
        img.src = dataURL;
    });
}
