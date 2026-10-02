// Schemes the OS may open for us. Anything else (file:, smb:, ms-msdt:,
// javascript: …) could start a program or read local files, so a link in a
// vault entry or a page must never reach shell.openExternal with it.
const EXTERNAL_PROTOCOLS = ["http:", "https:", "mailto:"];

/**
 * Check whether a URL may be handed to the operating system to open
 * @param url The URL to check
 * @returns True for http(s) and mailto links
 */
export function isSafeExternalURL(url: string): boolean {
    try {
        return EXTERNAL_PROTOCOLS.includes(new URL(url).protocol);
    } catch {
        return false;
    }
}

/**
 * Check whether a navigation stays on the app's own page. The renderer
 * routes with the URL hash, so only the hash may differ.
 * @param url The URL being navigated to
 * @param appURL The file URL of the app's index.html
 * @returns True if the navigation stays inside the app
 */
export function isAppURL(url: string, appURL: string): boolean {
    try {
        const target = new URL(url);
        const app = new URL(appURL);
        return (
            target.protocol === "file:" && target.pathname === app.pathname && target.search === ""
        );
    } catch {
        return false;
    }
}
