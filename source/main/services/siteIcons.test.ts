import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { jest } from "@jest/globals";
import type { FetchedResource, IconFetcher } from "./siteIcons";

const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "bcup-site-icons-"));

jest.unstable_mockModule("./storage", () => ({ getSiteIconCachePath: () => cacheDir }));
jest.unstable_mockModule("../library/log", () => ({ logWarn: jest.fn() }));

let siteIcons: typeof import("./siteIcons");

beforeAll(async () => {
    siteIcons = await import("./siteIcons");
});

afterAll(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
});

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const ICO = Uint8Array.from([0x00, 0x00, 0x01, 0x00, 1, 0, 16, 16]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const HTML_ERROR = new TextEncoder().encode("<html><body>Not found</body></html>");

// A fake web: URL → [final URL after redirects, body]
function fakeFetcher(web: Record<string, [string, Uint8Array | string]>) {
    const requested: Array<string> = [];
    const fetcher: IconFetcher = async (url) => {
        requested.push(url);
        const page = web[url];
        if (!page) return null;
        const [finalURL, body] = page;
        const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
        return { url: finalURL, body: bytes } as FetchedResource;
    };
    return { fetcher, requested };
}

const dataURL = (type: string, bytes: Uint8Array) =>
    `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;

describe("findIconLinks", () => {
    test("reads icon links from the page head, resolved against the page", () => {
        const html = `<html><head>
            <link rel="stylesheet" href="/style.css">
            <link rel="icon" href="/static/icon-32.png" sizes="32x32">
            <link rel="apple-touch-icon" href="https://cdn.example.net/touch.png">
            <link rel="mask-icon" href="/mask.svg">
        </head><body><link rel="icon" href="/late.png"></body></html>`;
        expect(siteIcons.findIconLinks(html, "https://www.example.com/start")).toEqual([
            "https://www.example.com/static/icon-32.png",
            "https://cdn.example.net/touch.png"
        ]);
    });

    test("prefers the size closest to 64px, and SVGs", () => {
        const html = `<link rel="icon" href="a16.png" sizes="16x16">
            <link rel='shortcut icon' href='a64.png' sizes='64x64'>
            <link href=a512.png rel=icon sizes=512x512>`;
        expect(siteIcons.findIconLinks(html, "https://example.com/")).toEqual([
            "https://example.com/a64.png",
            "https://example.com/a16.png",
            "https://example.com/a512.png"
        ]);
        const svg = `<link rel="icon" href="a32.png" sizes="32x32"><link rel="icon" type="image/svg+xml" href="a.svg">`;
        expect(siteIcons.findIconLinks(svg, "https://example.com/")[0]).toBe(
            "https://example.com/a.svg"
        );
    });

    test("skips plain http and odd links, decodes entities", () => {
        const html = `<link rel="icon" href="http://example.com/insecure.png">
            <link rel="icon" href="javascript:alert(1)">
            <link rel="icon">
            <link rel="icon" href="/i.png?v=1&amp;s=2">`;
        expect(siteIcons.findIconLinks(html, "https://example.com/")).toEqual([
            "https://example.com/i.png?v=1&s=2"
        ]);
    });
});

describe("sniffImageType", () => {
    test("recognises images by their bytes", () => {
        expect(siteIcons.sniffImageType(PNG)).toBe("image/png");
        expect(siteIcons.sniffImageType(ICO)).toBe("image/x-icon");
        expect(siteIcons.sniffImageType(SVG)).toBe("image/svg+xml");
    });

    test("refuses anything else, like an HTML error page", () => {
        expect(siteIcons.sniffImageType(HTML_ERROR)).toBeNull();
        expect(siteIcons.sniffImageType(new Uint8Array())).toBeNull();
    });
});

describe("loadSiteIcon", () => {
    test("uses the icon the page declares (a site without /favicon.ico)", async () => {
        const { fetcher } = fakeFetcher({
            "https://example.com/": [
                "https://www.example.com/",
                '<head><link rel="icon" href="/img/logo.png"></head>'
            ],
            "https://www.example.com/img/logo.png": ["https://www.example.com/img/logo.png", PNG]
        });
        expect(await siteIcons.loadSiteIcon("example.com", fetcher)).toBe(
            dataURL("image/png", PNG)
        );
    });

    test("falls back to /favicon.ico on the redirected site, then the host", async () => {
        const { fetcher, requested } = fakeFetcher({
            "https://example.com/": ["https://www.example.com/", "<head></head>"],
            "https://example.com/favicon.ico": ["https://example.com/favicon.ico", ICO]
        });
        expect(await siteIcons.loadSiteIcon("example.com", fetcher)).toBe(
            dataURL("image/x-icon", ICO)
        );
        expect(requested).toEqual([
            "https://example.com/",
            "https://www.example.com/favicon.ico",
            "https://example.com/favicon.ico"
        ]);
    });

    test("tries the next candidate when one isn't an image", async () => {
        const { fetcher } = fakeFetcher({
            "https://example.com/": [
                "https://example.com/",
                '<link rel="icon" href="/missing.png"><link rel="icon" href="/ok.svg" sizes="any">'
            ],
            "https://example.com/ok.svg": ["https://example.com/ok.svg", HTML_ERROR],
            "https://example.com/missing.png": ["https://example.com/missing.png", HTML_ERROR],
            "https://example.com/favicon.ico": ["https://example.com/favicon.ico", PNG]
        });
        expect(await siteIcons.loadSiteIcon("example.com", fetcher)).toBe(
            dataURL("image/png", PNG)
        );
    });

    test("accepts an icon embedded in the page", async () => {
        const embedded = dataURL("image/png", PNG);
        const { fetcher, requested } = fakeFetcher({
            "https://example.com/": ["https://example.com/", `<link rel="icon" href="${embedded}">`]
        });
        expect(await siteIcons.loadSiteIcon("example.com", fetcher)).toBe(embedded);
        expect(requested).toEqual(["https://example.com/"]);
    });

    test("gives null when the site has no icon or can't be reached", async () => {
        const { fetcher } = fakeFetcher({});
        expect(await siteIcons.loadSiteIcon("example.com", fetcher)).toBeNull();
        const failing: IconFetcher = async () => {
            throw new Error("ENOTFOUND");
        };
        expect(await siteIcons.loadSiteIcon("example.com", failing)).toBeNull();
    });
});

describe("getSiteIcon", () => {
    test("only looks up plain host names", async () => {
        const { fetcher, requested } = fakeFetcher({});
        expect(await siteIcons.getSiteIcon("javascript:alert(1)", fetcher)).toBeNull();
        expect(await siteIcons.getSiteIcon("evil.test/../x", fetcher)).toBeNull();
        expect(await siteIcons.getSiteIcon(42, fetcher)).toBeNull();
        expect(requested).toEqual([]);
    });

    test("caches the result on disk, also when there's no icon", async () => {
        const site = fakeFetcher({
            "https://cached.example/favicon.ico": ["https://cached.example/favicon.ico", PNG]
        });
        expect(await siteIcons.getSiteIcon("Cached.Example", site.fetcher)).toBe(
            dataURL("image/png", PNG)
        );
        expect(fs.readdirSync(cacheDir)).toHaveLength(1);
        const none = fakeFetcher({});
        expect(await siteIcons.getSiteIcon("noicon.example", none.fetcher)).toBeNull();
        expect(fs.readdirSync(cacheDir)).toHaveLength(2);
        const files = fs
            .readdirSync(cacheDir)
            .map((f) => JSON.parse(fs.readFileSync(path.join(cacheDir, f), "utf8")));
        expect(files.map((f) => f.icon).sort()).toEqual([dataURL("image/png", PNG), null].sort());
    });

    test("asks each host once while a lookup is running", async () => {
        const { fetcher, requested } = fakeFetcher({
            "https://once.example/favicon.ico": ["https://once.example/favicon.ico", PNG]
        });
        const [a, b] = await Promise.all([
            siteIcons.getSiteIcon("once.example", fetcher),
            siteIcons.getSiteIcon("once.example", fetcher)
        ]);
        expect(a).toBe(b);
        expect(requested.filter((url) => url.endsWith("/favicon.ico"))).toHaveLength(1);
    });
});
