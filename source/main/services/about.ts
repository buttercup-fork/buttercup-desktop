import { app, clipboard } from "electron";
import { openExternalSafely } from "./navigation";
import { getUpdateStatus } from "./update";
import { isPortable } from "../library/portability";
import { AboutInfo, AboutLinkID } from "../types";

const REPO_URL = "https://github.com/buttercup-fork/buttercup-desktop";

// The About dialog's links. The window sends only a link's name, so it can't
// have the main process open an address of its choosing (B-810).
const ABOUT_LINKS: Readonly<Record<AboutLinkID, string>> = Object.freeze({
    website: "https://buttercup.codekunde.net",
    releases: `${REPO_URL}/releases`,
    issues: `${REPO_URL}/issues`,
    security: `${REPO_URL}/security/policy`,
    licence: `${REPO_URL}/blob/master/LICENSE`
});

const PLATFORM_LABELS: Partial<Record<NodeJS.Platform, string>> = {
    darwin: "macOS",
    linux: "Linux",
    win32: "Windows"
};

// A version as package.json holds it ("8.0.0", "8.0.0-rc.1"), nothing else
const VERSION_PATTERN = /^[0-9A-Za-z.+-]{1,40}$/;

export function copyAboutDetails(coreVersion: unknown): void {
    if (typeof coreVersion !== "string" || !VERSION_PATTERN.test(coreVersion)) {
        throw new Error("Invalid core version for the About details");
    }
    // A plain copy: these details are meant for a bug report, so clipboard history
    // may keep them (vault values use the concealed copy instead)
    clipboard.writeText(formatAboutDetails(getAboutInfo(), coreVersion));
}

export function formatAboutDetails(info: AboutInfo, coreVersion: string): string {
    return [
        `Buttercup ${info.version} (${info.install})`,
        `Core ${coreVersion}`,
        `Electron ${info.electron}, Chromium ${info.chrome}, Node.js ${info.node}`,
        `${info.platform} ${info.arch}`
    ].join("\n");
}

export function getAboutInfo(): AboutInfo {
    return {
        version: app.getVersion(),
        electron: process.versions.electron ?? "",
        chrome: process.versions.chrome ?? "",
        node: process.versions.node,
        platform: platformLabel(process.platform),
        arch: process.arch,
        install: isPortable() ? "portable" : process.env.APPIMAGE ? "AppImage" : "installed",
        update: getUpdateStatus()
    };
}

export function openAboutLink(id: unknown): void {
    if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(ABOUT_LINKS, id)) {
        throw new Error(`Unknown About link: ${String(id)}`);
    }
    openExternalSafely(ABOUT_LINKS[id as AboutLinkID]);
}

export function platformLabel(platform: NodeJS.Platform): string {
    return PLATFORM_LABELS[platform] ?? platform;
}
