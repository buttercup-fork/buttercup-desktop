/** True when this platform can mark clipboard text as confidential (Windows). */
export function isSupported(): boolean;
/**
 * Write text to the clipboard, marked so clipboard history and cloud clipboard
 * sync skip it. Returns false when not supported or the clipboard was busy;
 * the caller should then fall back to a normal copy.
 */
export function writeConcealedText(text: string): boolean;
