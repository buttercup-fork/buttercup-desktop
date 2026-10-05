import { extractDomain, isIconDomain } from "./domain";

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

describe("isIconDomain", () => {
    test("accepts a plain host name", () => {
        expect(isIconDomain("www.example.com")).toBe(true);
        expect(isIconDomain("intranet")).toBe(true);
    });

    test("refuses a missing or odd domain", () => {
        expect(isIconDomain(null)).toBe(false);
        expect(isIconDomain("")).toBe(false);
        expect(isIconDomain("javascript:alert(1)")).toBe(false);
        expect(isIconDomain("evil.test/../x")).toBe(false);
        expect(isIconDomain("a b.test")).toBe(false);
    });
});
