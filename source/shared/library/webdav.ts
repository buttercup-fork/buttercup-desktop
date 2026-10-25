// Hosts where plain http stays on this computer. Same rule as core's
// WebDAVDatasource (B-684): keep the two in step
const LOOPBACK_HOST = /^(localhost|127(\.\d{1,3}){3}|\[::1\])$/i;

/**
 * Whether a WebDAV address would send the username and password unencrypted:
 * plain `http` to a host other than this computer (B-684)
 * @param url The WebDAV address as typed
 */
export function isInsecureWebDAVURL(url: string): boolean {
    try {
        const parsed = new URL(url.trim());
        return parsed.protocol === "http:" && !LOOPBACK_HOST.test(parsed.hostname);
    } catch (err) {
        return false;
    }
}
