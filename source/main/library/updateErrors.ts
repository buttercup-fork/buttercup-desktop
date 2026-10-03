// electron-updater error codes for a release feed that isn't there: no releases
// published yet, or the releases page answering 404 (as GitHub does while the
// account is suspended or the repository is private)
const FEED_UNAVAILABLE_CODES = [
    "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND",
    "ERR_UPDATER_LATEST_VERSION_NOT_FOUND",
    "ERR_UPDATER_NO_PUBLISHED_VERSIONS"
];

/**
 * Whether an update error means the release feed can't be found, rather than
 * an update that failed. Nothing the user can do about it, so it shouldn't
 * show an error every time the app checks.
 */
export function isUpdateFeedUnavailable(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const { code, statusCode } = err as { code?: unknown; statusCode?: unknown };
    if (statusCode === 404) return true;
    return typeof code === "string" && FEED_UNAVAILABLE_CODES.includes(code);
}
