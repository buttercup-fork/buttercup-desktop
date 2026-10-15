import { randomInt, timingSafeEqual } from "node:crypto";
import type { BrowserWindow } from "electron";
import { Layerr } from "layerr";
import { getMainWindow, openMainWindow } from "../windows";

export const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const CODE_LENGTH = 12;

let __code: string | null = null;

export async function clearCode(): Promise<void> {
    __code = null;
    const window = getMainWindow();
    if (window) {
        window.webContents.send("browser-access-code-hide");
    }
}

function codesMatch(expected: string, entered: string): boolean {
    const expectedBytes = Buffer.from(expected);
    const enteredBytes = Buffer.from(entered);
    return (
        expectedBytes.length === enteredBytes.length && timingSafeEqual(expectedBytes, enteredBytes)
    );
}

function generateCode(length: number): string {
    const chars = CODE_CHARS.length;
    let code = "";
    while (code.length < length) {
        code = `${code}${CODE_CHARS[randomInt(chars)]}`;
    }
    return code;
}

export async function promptUserForBrowserAccess() {
    clearCode();
    let window: BrowserWindow;
    try {
        window = await openMainWindow();
    } catch (err) {
        throw new Layerr(err, "Failed opening window");
    }
    __code = generateCode(CODE_LENGTH);
    window.webContents.send("browser-access-code", JSON.stringify({ code: __code }));
}

export async function validateEnteredCode(browserCode: string): Promise<boolean> {
    const valid = __code !== null && codesMatch(__code, browserCode);
    await clearCode();
    return valid;
}
