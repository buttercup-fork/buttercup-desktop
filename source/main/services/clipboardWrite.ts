import { clipboard } from "electron";
import { writeConcealedText } from "@codekunde/conceal-clipboard";
import { logWarn } from "../library/log";

/**
 * Copy text from a vault. Where the platform supports it (Windows), the copy is
 * marked confidential so clipboard history (Win+V) and cloud clipboard sync
 * skip it (B-8). Otherwise, or if that fails, it's a normal copy.
 */
export function writeClipboardText(text: string): void {
    let concealed = false;
    try {
        concealed = writeConcealedText(text);
    } catch (err) {
        logWarn("Concealed clipboard copy failed, copying normally", err);
    }
    if (!concealed) {
        clipboard.writeText(text);
    }
}
