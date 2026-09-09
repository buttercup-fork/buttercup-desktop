import { ipcRenderer } from "electron";
import debounce from "debounce";

function handleActivity() {
    ipcRenderer.invoke("trigger-user-presence");
}

export function initialisePresence(rootElement: HTMLElement) {
    const handler = debounce(handleActivity, 250);
    rootElement.addEventListener("mousemove", handler);
    // Keyboard activity counts too, so typing (e.g. into an entry) keeps the
    // auto-lock timer from firing.
    rootElement.addEventListener("keydown", handler);
}
