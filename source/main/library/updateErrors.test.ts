import { isUpdateFeedUnavailable } from "./updateErrors";

const withProps = (message: string, props: Record<string, unknown>) =>
    Object.assign(new Error(message), props);

test("a 404 from the releases feed means the feed is unavailable", () => {
    expect(isUpdateFeedUnavailable(withProps("404", { statusCode: 404 }))).toBe(true);
});

test("electron-updater's missing-release codes mean the feed is unavailable", () => {
    for (const code of [
        "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND",
        "ERR_UPDATER_LATEST_VERSION_NOT_FOUND",
        "ERR_UPDATER_NO_PUBLISHED_VERSIONS"
    ]) {
        expect(isUpdateFeedUnavailable(withProps("missing", { code }))).toBe(true);
    }
});

test("other errors are real update failures", () => {
    expect(isUpdateFeedUnavailable(withProps("500", { statusCode: 500 }))).toBe(false);
    expect(
        isUpdateFeedUnavailable(withProps("bad sig", { code: "ERR_UPDATER_INVALID_SIGNATURE" }))
    ).toBe(false);
    expect(isUpdateFeedUnavailable(new Error("net::ERR_CONNECTION_RESET"))).toBe(false);
    expect(isUpdateFeedUnavailable(null)).toBe(false);
});
