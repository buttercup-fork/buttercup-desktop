import { ipcRenderer } from "../library/ipcRenderer";

/**
 * Sign in on a provider's page in its own window (opened by the main process)
 * @param authURL The provider's sign-in page
 * @param matchRegex Matches the redirect URL that carries the token; its first group is the token
 * @returns The token, or null if the window was closed without one
 */
export async function authenticate(authURL: string, matchRegex: RegExp): Promise<string | null> {
    return ipcRenderer.invoke(
        "authenticate-3rd-party",
        authURL,
        matchRegex.source,
        matchRegex.flags
    );
}
