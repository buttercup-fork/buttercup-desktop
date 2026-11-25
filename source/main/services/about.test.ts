import { jest } from "@jest/globals";

const mockOpenExternal = jest.fn();
const mockWriteText = jest.fn();
const mockIsPortable = jest.fn(() => false);
const mockGetUpdateStatus = jest.fn(() => ({ state: "up-to-date", checkedAt: 1 }));

jest.unstable_mockModule("electron", () => ({
    app: { getVersion: () => "3.0.0" },
    clipboard: { writeText: mockWriteText }
}));
jest.unstable_mockModule("./navigation", () => ({ openExternalSafely: mockOpenExternal }));
jest.unstable_mockModule("../library/portability", () => ({ isPortable: mockIsPortable }));
jest.unstable_mockModule("./update", () => ({ getUpdateStatus: mockGetUpdateStatus }));

let about: typeof import("./about");

const REPO = "https://github.com/buttercup-fork/buttercup-desktop";

beforeAll(async () => {
    about = await import("./about");
});

beforeEach(() => {
    mockOpenExternal.mockClear();
    mockWriteText.mockClear();
    mockIsPortable.mockReturnValue(false);
    delete process.env.APPIMAGE;
});

describe("About links", () => {
    test.each([
        ["website", "https://buttercup.codekunde.net"],
        ["releases", `${REPO}/releases`],
        ["issues", `${REPO}/issues`],
        ["security", `${REPO}/security/policy`],
        ["licence", `${REPO}/blob/master/LICENSE`]
    ])("%s opens its fixed address", (id, url) => {
        about.openAboutLink(id);
        expect(mockOpenExternal).toHaveBeenCalledWith(url);
    });

    // The window names a link; it never sends an address, so a compromised
    // page can't use this channel to open anything else
    test.each([
        "https://example.com",
        "file:///C:/Windows/System32/calc.exe",
        "__proto__",
        "constructor",
        "toString",
        "",
        42,
        null,
        undefined,
        { id: "website" }
    ])("refuses %p", (id) => {
        expect(() => about.openAboutLink(id)).toThrow(/Unknown About link/);
        expect(mockOpenExternal).not.toHaveBeenCalled();
    });
});

describe("About information", () => {
    test("reads the app, runtime and update facts", () => {
        const info = about.getAboutInfo();
        expect(info).toEqual({
            version: "3.0.0",
            electron: process.versions.electron ?? "",
            chrome: process.versions.chrome ?? "",
            node: process.versions.node,
            platform: expect.any(String),
            arch: process.arch,
            install: "installed",
            update: { state: "up-to-date", checkedAt: 1 }
        });
    });

    test.each([
        ["win32", "Windows"],
        ["darwin", "macOS"],
        ["linux", "Linux"],
        ["freebsd", "freebsd"]
    ])("names platform %s as %s", (platform, label) => {
        expect(about.platformLabel(platform as NodeJS.Platform)).toBe(label);
    });

    test("names a portable build", () => {
        mockIsPortable.mockReturnValue(true);
        expect(about.getAboutInfo().install).toBe("portable");
    });

    test("names an AppImage", () => {
        process.env.APPIMAGE = "/home/user/Buttercup.AppImage";
        expect(about.getAboutInfo().install).toBe("AppImage");
    });
});

describe("Copy details", () => {
    const info = {
        version: "3.0.0",
        electron: "44.11.3",
        chrome: "152.0.7977.169",
        node: "24.22.2",
        platform: "Windows",
        arch: "x64",
        install: "installed" as const,
        update: { state: "up-to-date" as const, checkedAt: 1 }
    };

    test("formats the details for a bug report", () => {
        expect(about.formatAboutDetails(info, "8.0.0")).toBe(
            [
                "Buttercup 3.0.0 (installed)",
                "Core 8.0.0",
                "Electron 44.11.3, Chromium 152.0.7977.169, Node.js 24.22.2",
                "Windows x64"
            ].join("\n")
        );
    });

    test("copies them as plain text, not as a concealed vault copy", () => {
        about.copyAboutDetails("8.0.0");
        expect(mockWriteText).toHaveBeenCalledTimes(1);
        const text = mockWriteText.mock.calls[0][0] as string;
        expect(text).toMatch(/^Buttercup 3\.0\.0 \(installed\)\nCore 8\.0\.0\n/);
        expect(text).toContain(`Node.js ${process.versions.node}`);
    });

    // The window passes only the core version it was built with; anything that
    // isn't a version is refused instead of landing on the clipboard
    test.each(["8.0.0\nmalicious", "", "x".repeat(41), 8, null, undefined])(
        "refuses core version %p",
        (version) => {
            expect(() => about.copyAboutDetails(version)).toThrow(/core version/);
            expect(mockWriteText).not.toHaveBeenCalled();
        }
    );
});
