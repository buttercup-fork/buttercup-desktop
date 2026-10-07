import { ipcRenderer } from "../library/ipcRenderer";
import type { VaultSourceID } from "buttercup";
import { logInfo } from "../library/log";
import { openLinkExternally } from "../actions/link";

// The sign-in itself runs in the main process (services/googleDrive.ts), which
// listens on a loopback redirect for Google's auth code.

export async function authenticateGoogleDrive(): Promise<{
    accessToken: string;
    refreshToken: string;
}> {
    logInfo("Authenticating Google Drive");
    const url = await getGoogleDriveAuthURL();
    openLinkExternally(url);
    return waitForGoogleAuthCode();
}

/**
 * Start a sign-in and return the URL to open. Follow with waitForGoogleAuthCode().
 */
export async function getGoogleDriveAuthURL(): Promise<string> {
    return ipcRenderer.invoke("google-auth-begin");
}

export async function updateGoogleTokensForSource(
    sourceID: VaultSourceID,
    tokens: { accessToken: string; refreshToken: string }
): Promise<void> {
    await ipcRenderer.invoke("set-reauth-google-tokens", sourceID, tokens);
}

export async function waitForGoogleAuthCode(): Promise<{
    accessToken: string;
    refreshToken: string;
}> {
    return ipcRenderer.invoke("google-auth-complete");
}
