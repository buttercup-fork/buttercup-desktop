import crypto from "crypto";
import path from "path";
import { SourceType } from "../types";

interface DatasourceLocation {
    type: string;
    [key: string]: any;
}

// Local file systems that usually ignore letter case
const CASE_INSENSITIVE_FILES = process.platform === "win32" || process.platform === "darwin";

function describeLocation(config: DatasourceLocation): string | null {
    switch (config.type) {
        case SourceType.File: {
            if (!config.path) return null;
            const filePath = path.resolve(config.path);
            return CASE_INSENSITIVE_FILES ? filePath.toLowerCase() : filePath;
        }
        case SourceType.WebDAV: {
            if (!config.endpoint || !config.path) return null;
            let endpoint: string;
            try {
                const url = new URL(config.endpoint);
                endpoint = `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
            } catch {
                endpoint = String(config.endpoint).replace(/\/+$/, "");
            }
            const filePath = `/${String(config.path).replace(/^\/+/, "")}`;
            return `${endpoint}\n${filePath}\n${config.username ?? ""}`;
        }
        case SourceType.GoogleDrive:
            return config.fileID ? String(config.fileID) : null;
        default:
            // Dropbox: the config doesn't say which account the file is in, so
            // the same path in two accounts can't be told apart
            return null;
    }
}

/**
 * A fingerprint of where a vault lives, to recognise the same vault being
 * added twice (#1172). Hashed so the vault list doesn't store paths or URLs.
 * @returns The key, or null when the location can't be identified
 */
export function getVaultLocationKey(config: DatasourceLocation | null | undefined): string | null {
    if (!config) return null;
    const location = describeLocation(config);
    if (!location) return null;
    return crypto.createHash("sha256").update(`${config.type}\n${location}`).digest("hex");
}
