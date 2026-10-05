import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getSiteIconCachePath } from "./storage";
import { logWarn } from "../library/log";

/**
 * Site icons for entries (#1071): the icon a site declares in its page
 * (`<link rel="icon">`), or its `/favicon.ico`. Fetched only from the entry's
 * own site (or where that site points for its icon), never through an icon
 * service, and without cookies. Results, also "no icon", are cached on disk.
 */

export type IconFetcher = (url: string, accept: string) => Promise<FetchedResource | null>;

export interface FetchedResource {
    // The URL after redirects
    url: string;
    body: Uint8Array;
}

interface CachedIcon {
    v: 1;
    fetched: number;
    icon: string | null;
}

const HOSTNAME = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/i;
const PAGE_MAX_BYTES = 512 * 1024;
const ICON_MAX_BYTES = 256 * 1024;
const REQUEST_TIMEOUT = 8000;
const MAX_REDIRECTS = 5;
const MAX_PARALLEL = 4;
const CACHE_TTL_FOUND = 14 * 24 * 60 * 60 * 1000;
const CACHE_TTL_MISSING = 2 * 24 * 60 * 60 * 1000;
// Sizes closest to this look best in the 32px list icon (and on HiDPI screens)
const PREFERRED_SIZE = 64;

const __pending = new Map<string, Promise<string | null>>();
let __running = 0;
const __waiting: Array<() => void> = [];

export function isIconHost(host: unknown): host is string {
    return typeof host === "string" && host.length <= 253 && HOSTNAME.test(host);
}

/**
 * The icon URLs a page declares, best first. Masks (`mask-icon`, single colour
 * SVGs for Safari pinned tabs) are left out.
 */
export function findIconLinks(html: string, pageURL: string): Array<string> {
    const head = html.split(/<\/head\s*>/i)[0];
    const links: Array<{ url: string; score: number; index: number }> = [];
    const tags = head.match(/<link\b[^>]*>/gi) || [];
    tags.forEach((tag, index) => {
        const rel = getAttribute(tag, "rel")?.toLowerCase().split(/\s+/) ?? [];
        if (!rel.includes("icon") && !rel.includes("apple-touch-icon")) return;
        const href = getAttribute(tag, "href");
        if (!href) return;
        let url: URL;
        try {
            url = new URL(decodeEntities(href), pageURL);
        } catch {
            return;
        }
        if (url.protocol !== "https:" && url.protocol !== "data:") return;
        links.push({ url: url.href, score: scoreLink(tag, rel), index });
    });
    return links
        .sort((a, b) => a.score - b.score || a.index - b.index)
        .map((link) => link.url)
        .filter((url, i, all) => all.indexOf(url) === i);
}

function scoreLink(tag: string, rel: Array<string>): number {
    // Lower is better: closest to the preferred size, then plain icons over
    // touch icons (those are often padded for a home screen)
    const sizes = getAttribute(tag, "sizes")?.toLowerCase() ?? "";
    const type = getAttribute(tag, "type")?.toLowerCase() ?? "";
    let score = rel.includes("icon") ? 0 : 50;
    if (sizes === "any" || type === "image/svg+xml") return score;
    const size = Math.max(0, ...[...sizes.matchAll(/(\d+)x(\d+)/g)].map((m) => parseInt(m[1], 10)));
    score += size ? Math.abs(size - PREFERRED_SIZE) / 4 : 10;
    return score;
}

function getAttribute(tag: string, name: string): string | null {
    const match = tag.match(
        new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i")
    );
    return match ? (match[1] ?? match[2] ?? match[3]) : null;
}

function decodeEntities(text: string): string {
    return text
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}

/**
 * The image type, read from the bytes: servers often send favicons with the
 * wrong content type, and anything that isn't an image is refused.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
    const starts = (...sig: Array<number>) => sig.every((b, i) => bytes[i] === b);
    if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
    if (starts(0x00, 0x00, 0x01, 0x00)) return "image/x-icon";
    if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
    if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
    if (starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
        return "image/webp";
    }
    const text = new TextDecoder().decode(bytes.slice(0, 512)).trimStart().toLowerCase();
    if (text.startsWith("<svg") || (text.startsWith("<?xml") && text.includes("<svg"))) {
        return "image/svg+xml";
    }
    return null;
}

function toDataURL(bytes: Uint8Array): string | null {
    const type = sniffImageType(bytes);
    return type ? `data:${type};base64,${Buffer.from(bytes).toString("base64")}` : null;
}

/**
 * Find and download a host's icon
 * @returns A data URL, or null when the site has no usable icon
 */
export async function loadSiteIcon(host: string, fetcher: IconFetcher): Promise<string | null> {
    const page = await fetcher(`https://${host}/`, "text/html").catch(() => null);
    const candidates = page ? findIconLinks(new TextDecoder().decode(page.body), page.url) : [];
    // The favicon at the site the page redirected to (eg. www.), then at the host itself
    if (page) candidates.push(new URL("/favicon.ico", page.url).href);
    candidates.push(`https://${host}/favicon.ico`);
    for (const url of candidates.filter((url, i, all) => all.indexOf(url) === i)) {
        if (url.startsWith("data:")) {
            const icon = dataURLIcon(url);
            if (icon) return icon;
            continue;
        }
        const image = await fetcher(url, "image/*").catch(() => null);
        const icon = image && image.body.length > 0 ? toDataURL(image.body) : null;
        if (icon) return icon;
    }
    return null;
}

function dataURLIcon(url: string): string | null {
    const match = url.match(/^data:[^,]*?(;base64)?,([\s\S]*)$/);
    if (!match) return null;
    const bytes = match[1]
        ? Buffer.from(match[2], "base64")
        : Buffer.from(decodeURIComponent(match[2]), "utf8");
    return bytes.length <= ICON_MAX_BYTES ? toDataURL(bytes) : null;
}

/**
 * Fetch with a timeout and a size cap. NodeJS's fetch, not the app's Chromium
 * session: it sends no cookies and not the Origin header the app adds to its
 * own requests, and it tells which URL a redirect ended on (Electron's fetch
 * doesn't). Redirects are followed here so each one has to stay on https.
 */
async function fetchResource(url: string, accept: string): Promise<FetchedResource | null> {
    const maxBytes = accept === "text/html" ? PAGE_MAX_BYTES : ICON_MAX_BYTES;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
        let res: Response;
        for (let hops = 0; ; hops += 1) {
            if (!url.startsWith("https:") || hops > MAX_REDIRECTS) return null;
            res = await fetch(url, {
                headers: { Accept: accept },
                redirect: "manual",
                signal: controller.signal
            });
            const location = res.status >= 300 && res.status < 400 && res.headers.get("location");
            if (!location) break;
            await res.body?.cancel();
            url = new URL(location, url).href;
        }
        if (!res.ok || !res.body) return null;
        const reader = res.body.getReader();
        const chunks: Array<Uint8Array> = [];
        let size = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            size += value.length;
            if (size > maxBytes) {
                await reader.cancel();
                // A page is only needed up to its <head>; an icon this big is refused
                if (accept !== "text/html") return null;
                break;
            }
        }
        return { url, body: Buffer.concat(chunks) };
    } finally {
        clearTimeout(timer);
    }
}

function cacheFile(host: string): string {
    const name = crypto.createHash("sha256").update(host.toLowerCase()).digest("hex");
    return path.join(getSiteIconCachePath(), `${name}.json`);
}

async function readCache(host: string): Promise<CachedIcon | null> {
    try {
        const cached = JSON.parse(await fs.readFile(cacheFile(host), "utf8")) as CachedIcon;
        const ttl = cached.icon ? CACHE_TTL_FOUND : CACHE_TTL_MISSING;
        return cached.v === 1 && Date.now() - cached.fetched < ttl ? cached : null;
    } catch {
        return null;
    }
}

async function writeCache(host: string, icon: string | null): Promise<void> {
    try {
        await fs.mkdir(getSiteIconCachePath(), { recursive: true });
        const cached: CachedIcon = { v: 1, fetched: Date.now(), icon };
        await fs.writeFile(cacheFile(host), JSON.stringify(cached));
    } catch (err) {
        logWarn(`Failed caching the site icon of ${host}`, err);
    }
}

async function limited<T>(task: () => Promise<T>): Promise<T> {
    if (__running >= MAX_PARALLEL) {
        await new Promise<void>((resolve) => __waiting.push(resolve));
    }
    __running += 1;
    try {
        return await task();
    } finally {
        __running -= 1;
        __waiting.shift()?.();
    }
}

/**
 * The icon for a host, from the disk cache or the site
 * @returns A data URL, or null
 */
export function getSiteIcon(
    host: unknown,
    fetcher: IconFetcher = fetchResource
): Promise<string | null> {
    if (!isIconHost(host)) return Promise.resolve(null);
    const key = host.toLowerCase();
    if (!__pending.has(key)) {
        const loading = (async () => {
            const cached = await readCache(key);
            if (cached) return cached.icon;
            const icon = await limited(() => loadSiteIcon(key, fetcher)).catch(() => null);
            await writeCache(key, icon);
            return icon;
        })();
        __pending.set(key, loading);
        // Keep the result in memory for this run; a failure is retried next start
        loading.catch(() => __pending.delete(key));
    }
    return __pending.get(key)!;
}
