import { isOriginAllowed, isRequestAllowed, LOOPBACK_ADDRESSES } from "./network";

describe("isRequestAllowed", () => {
    test("allows this computer's own names, with or without a port", () => {
        expect(isRequestAllowed({ host: "localhost:12822" })).toBe(true);
        expect(isRequestAllowed({ host: "localhost" })).toBe(true);
        expect(isRequestAllowed({ host: "127.0.0.1:12822" })).toBe(true);
        expect(isRequestAllowed({ host: "[::1]:12822" })).toBe(true);
        expect(isRequestAllowed({ host: "LocalHost:12822" })).toBe(true);
    });

    test("refuses any other host name (DNS rebinding)", () => {
        expect(isRequestAllowed({ host: "evil.example.com:12822" })).toBe(false);
        expect(isRequestAllowed({ host: "localhost.evil.example.com" })).toBe(false);
        expect(isRequestAllowed({ host: "127.0.0.1.evil.example.com:12822" })).toBe(false);
        expect(isRequestAllowed({ host: "192.168.1.20:12822" })).toBe(false);
        expect(isRequestAllowed({ host: "0.0.0.0:12822" })).toBe(false);
    });

    test("refuses a request with no Host", () => {
        expect(isRequestAllowed({})).toBe(false);
    });

    test("allows browser extensions and callers without an Origin", () => {
        const host = "localhost:12822";
        expect(isRequestAllowed({ host })).toBe(true);
        expect(isRequestAllowed({ host, origin: "chrome-extension://abcdefghijklmnop" })).toBe(
            true
        );
        expect(isRequestAllowed({ host, origin: "moz-extension://1234-5678-90ab" })).toBe(true);
        expect(isRequestAllowed({ host, origin: "safari-web-extension://ABCD-1234" })).toBe(true);
    });

    test("refuses web pages", () => {
        const host = "localhost:12822";
        expect(isRequestAllowed({ host, origin: "https://evil.example.com" })).toBe(false);
        expect(isRequestAllowed({ host, origin: "http://localhost:3000" })).toBe(false);
        expect(isRequestAllowed({ host, origin: "null" })).toBe(false);
        expect(isRequestAllowed({ host, origin: "file://" })).toBe(false);
    });
});

describe("isOriginAllowed", () => {
    test("refuses an extension scheme with a path or without an id", () => {
        expect(isOriginAllowed("chrome-extension://")).toBe(false);
        expect(isOriginAllowed("chrome-extension://abc/path")).toBe(false);
        expect(isOriginAllowed("chrome-extension:abc")).toBe(false);
    });

    test("refuses a look-alike scheme", () => {
        expect(isOriginAllowed("https://chrome-extension://abc")).toBe(false);
        expect(isOriginAllowed("xchrome-extension://abc")).toBe(false);
    });
});

test("listens on the loopback addresses only", () => {
    expect(LOOPBACK_ADDRESSES).toEqual(["127.0.0.1", "::1"]);
});
