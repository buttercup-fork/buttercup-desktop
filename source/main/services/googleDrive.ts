import { DatasourceAuthManager, GoogleDriveDatasource, VaultSourceID } from "buttercup";
import { ERR_REFRESH_FAILED, GoogleToken, OAuth2Client } from "@buttercup/google-oauth2-client";
import { Layerr } from "layerr";
import { getMainWindow } from "./windows";
import { openExternalSafely } from "./navigation";
import { LoopbackAuthSession, startLoopbackAuth } from "../library/googleLoopback";
import { logInfo, logWarn } from "../library/log";
import {
    GOOGLE_AUTH_TIMEOUT,
    GOOGLE_DRIVE_SCOPES_STANDARD,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
} from "../../shared/symbols";

const __googleDriveTokens: Record<VaultSourceID, { accessToken: string; refreshToken: string }> =
    {};
let __googleDriveOAuthClient: OAuth2Client = null;
let __pendingAuth: { client: OAuth2Client; session: LoopbackAuthSession } | null = null;

export function addGoogleTokens(
    sourceID: VaultSourceID,
    tokens: { accessToken: string; refreshToken: string }
) {
    __googleDriveTokens[sourceID] = tokens;
}

/**
 * Start a sign-in: open a loopback listener and return the Google URL to visit.
 * Any sign-in still pending is cancelled, so only one listener exists at a time.
 */
export async function beginGoogleAuth(): Promise<string> {
    __pendingAuth?.session.close();
    __pendingAuth = null;
    const session = await startLoopbackAuth(GOOGLE_AUTH_TIMEOUT);
    // The redirect URI must match exactly between the auth URL and the code
    // exchange, and it carries this session's port, so each sign-in gets its
    // own client.
    const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, session.redirectURI);
    __pendingAuth = { client, session };
    const url = client.generateAuthUrl({
        access_type: "offline",
        scope: [...GOOGLE_DRIVE_SCOPES_STANDARD],
        prompt: "consent select_account"
    });
    return `${url}&state=${session.state}`;
}

/**
 * Wait for the pending sign-in to redirect back, then exchange the code for tokens.
 */
export async function completeGoogleAuth(): Promise<{ accessToken: string; refreshToken: string }> {
    const pending = __pendingAuth;
    if (!pending) {
        throw new Error("No Google authentication in progress");
    }
    try {
        const authCode = await pending.session.waitForCode();
        logInfo("Google Drive: Received auth code - exchanging for tokens");
        // The client decodes the code before sending it; encode it so a code
        // containing "%" survives that round trip unchanged.
        const response = await pending.client.exchangeAuthCodeForToken(
            encodeURIComponent(authCode)
        );
        const { access_token: accessToken, refresh_token: refreshToken } = response.tokens;
        logInfo("Google Drive: tokens received");
        return {
            accessToken,
            refreshToken
        };
    } finally {
        if (__pendingAuth === pending) {
            __pendingAuth = null;
        }
    }
}

async function authenticateGoogleDrive(): Promise<{ accessToken: string; refreshToken: string }> {
    logInfo("Authenticating Google Drive");
    const url = await beginGoogleAuth();
    openExternalSafely(url);
    return completeGoogleAuth();
}

async function authenticateGoogleDriveWithRefreshToken(
    refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
    logInfo("Refreshing Google Drive token");
    const oauth2Client = getGoogleDriveOAuthClient();
    let results: { tokens: GoogleToken };
    try {
        results = await oauth2Client.refreshAccessToken(refreshToken);
    } catch (err) {
        // Google refused the refresh token (any 4xx). An expired or revoked
        // token gets a 400, but the refresh has also failed with another 4xx
        // (Ubuntu, 2026-10-03), which left the vault unopenable with "Bad
        // refresh response" instead of asking to sign in again (#1391).
        const { code, status, statusText } = Layerr.info(err);
        if (code === ERR_REFRESH_FAILED) {
            logWarn(`Google Drive token refresh refused: ${status} ${statusText ?? ""}`);
            return null;
        }
        throw err;
    }
    const { access_token: newAccessToken } = results.tokens;
    logInfo("Refreshed Google Drive token");
    return {
        accessToken: newAccessToken,
        refreshToken
    };
}

// Only used to refresh tokens, which doesn't involve a redirect.
function getGoogleDriveOAuthClient(): OAuth2Client {
    if (!__googleDriveOAuthClient) {
        __googleDriveOAuthClient = new OAuth2Client(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            "http://127.0.0.1"
        );
    }
    return __googleDriveOAuthClient;
}

export function registerGoogleDriveAuthHandlers() {
    DatasourceAuthManager.getSharedManager().registerHandler(
        "googledrive",
        async (datasource: GoogleDriveDatasource) => {
            if (datasource.sourceID && __googleDriveTokens[datasource.sourceID]) {
                logInfo(
                    `Refreshed auth tokens available for Google Drive source: ${datasource.sourceID}`
                );
                datasource.updateTokens(
                    __googleDriveTokens[datasource.sourceID].accessToken,
                    __googleDriveTokens[datasource.sourceID].refreshToken
                );
                delete __googleDriveTokens[datasource.sourceID];
                return;
            }
            logInfo(
                `Google Drive datasource needs re-authentication (source: ${datasource.sourceID})`
            );
            const { refreshToken: currentRefreshToken } = datasource;
            if (!currentRefreshToken) {
                logInfo(
                    "Datasource does not contain a refresh token: Performing full authorisation"
                );
                const { accessToken, refreshToken } = await authenticateGoogleDrive();
                datasource.updateTokens(accessToken, refreshToken);
                if (!refreshToken) {
                    logWarn("Updating Google Drive datasource access token without refresh token");
                }
            } else {
                logInfo("Datasource contains refresh token: Refreshing authorisation");
                const result = await authenticateGoogleDriveWithRefreshToken(currentRefreshToken);
                if (result === null) {
                    const win = getMainWindow();
                    if (win) {
                        logInfo("Refresh token expired: prompting for new authentication");
                        win.webContents.send("google-reauth", datasource.sourceID);
                    } else {
                        logWarn("Refresh token expired, but no window open for prompt");
                    }
                    return;
                }
                datasource.updateTokens(result.accessToken, currentRefreshToken);
            }
            logInfo("Google Drive datasource tokens updated");
        }
    );
}
