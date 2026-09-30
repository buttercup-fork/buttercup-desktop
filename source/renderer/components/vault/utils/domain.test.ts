import { extractDomain, getFaviconURL } from "./domain";

describe("extractDomain", () => {
    test("takes the host name from a URL", () => {
        expect(extractDomain("https://www.example.com/login?next=1")).toBe("www.example.com");
        expect(extractDomain("HTTP://Example.com")).toBe("Example.com");
    });

    test("drops the port", () => {
        expect(extractDomain("https://intranet.example.com:8443/app")).toBe("intranet.example.com");
    });

    test("handles URLs saved without a scheme", () => {
        expect(extractDomain("example.com/login")).toBe("example.com");
        expect(extractDomain(" example.com ")).toBe("example.com");
    });
});

describe("getFaviconURL", () => {
    test("fetches the favicon from the site itself", () => {
        expect(getFaviconURL("www.example.com")).toBe("https://www.example.com/favicon.ico");
    });

    test("never uses an icon service", () => {
        expect(getFaviconURL("example.com")).not.toMatch(/buttercup\.pw/);
    });

    test("gives nothing for a missing or odd domain", () => {
        expect(getFaviconURL(null)).toBeNull();
        expect(getFaviconURL("")).toBeNull();
        expect(getFaviconURL("javascript:alert(1)")).toBeNull();
        expect(getFaviconURL("evil.test/../x")).toBeNull();
        expect(getFaviconURL("a b.test")).toBeNull();
    });
});
