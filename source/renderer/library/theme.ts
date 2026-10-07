import { ipcRenderer } from "electron";
import { logInfo } from "./log";
import { Theme } from "../types";

// The main process owns the theme (the preference, or the system's): the window
// asks once at start-up and is told about changes.
let __dark = false;
let __listening = false;
const __subscribers = new Set<(theme: Theme) => void>();

export async function loadTheme(): Promise<void> {
    __dark = !!(await ipcRenderer.invoke("get-dark-colors"));
}

export function attachUpdatedListener() {
    if (__listening) return;
    __listening = true;
    ipcRenderer.on("theme-updated", (_, dark: boolean) => {
        __dark = !!dark;
        const theme = getThemeType();
        logInfo(`Theme updated: ${theme}`);
        updateBodyTheme(theme);
        __subscribers.forEach((callback) => callback(theme));
    });
}

export function getThemeType(): Theme {
    return __dark ? Theme.Dark : Theme.Light;
}

/**
 * Call back when the theme changes
 * @returns A function that stops it
 */
export function onThemeUpdated(callback: (theme: Theme) => void): () => void {
    __subscribers.add(callback);
    return () => {
        __subscribers.delete(callback);
    };
}

export function updateBodyTheme(theme: Theme) {
    logInfo(`Setting body theme: ${theme}`);
    if (theme === Theme.Dark) {
        window.document.body.classList.add("bp4-dark");
    } else {
        window.document.body.classList.remove("bp4-dark");
    }
}
