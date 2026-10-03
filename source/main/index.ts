import { app } from "electron";
import { initialize as initialiseElectronRemote } from "@electron/remote/main";
import "./ipc";
import { initialise } from "./services/init";
import { openMainWindow } from "./services/windows";
import { guardNavigation } from "./services/navigation";
import { handleProtocolCall, matchProtocolURL } from "./services/protocol";
import { ensureLinuxProtocolHandler } from "./services/linuxProtocol";
import { getConfigValue } from "./services/config";
import { getUnsavedSourceIDs } from "./services/buttercup";
import { confirmUnsavedChanges } from "./actions/unsaved";
import { shouldShowMainWindow, wasAutostarted } from "./services/arguments";
import { logErr, logInfo, logWarn } from "./library/log";
import { ignoreBrokenPipes } from "./library/stdio";
import { ACCEPTED_PROTOCOLS } from "./symbols";
import { AppStartMode } from "./types";

ignoreBrokenPipes([process.stdout, process.stderr]);

logInfo("Application starting");

// Release builds have no developer tools (#712), and the fuses in afterPack.js
// already block --inspect. Chromium's remote debugging switches have no fuse, and
// would give a console with Node access to the unlocked vaults, so a packaged
// build refuses to start with them.
if (
    app.isPackaged &&
    (app.commandLine.hasSwitch("remote-debugging-port") ||
        app.commandLine.hasSwitch("remote-debugging-pipe"))
) {
    logErr("Refusing to start: remote debugging is not allowed in release builds");
    process.exit(1);
}

// The AppImage's launcher adds --no-sandbox by itself when the system blocks the
// user namespaces Chromium's sandbox needs (Ubuntu 24.04 and later restrict them
// through AppArmor), so the app starts instead of crashing (#1355). Say so in the
// log: the .deb ships an AppArmor profile and keeps the sandbox.
if (process.platform === "linux" && app.commandLine.hasSwitch("no-sandbox")) {
    logWarn(
        "Running without the Chromium sandbox (--no-sandbox). The AppImage turns it off when " +
            "the system blocks unprivileged user namespaces; the .deb package keeps it."
    );
}

// Windows-only GPU-compositor workaround: on some Windows GPU driver / Chromium
// combinations, the window leaves stale pixels between repaints - most visibly a
// line between the menu bar and the vault-tab strip that only clears wherever the
// cursor hovers. Confirmed fixed by disabling GPU compositing (see UPSTREAM-ISSUES.md,
// "Fork-discovered" table). Must run before the app is ready.
if (process.platform === "win32") {
    app.commandLine.appendSwitch("disable-gpu-compositing");
}

guardNavigation();

const lock = app.requestSingleInstanceLock();
if (!lock) {
    app.quit();
}

// Protocol URL passed on the command line when the app is cold-started by a link
// (Linux/Windows). A running instance instead receives it via "second-instance".
const initialProtocolURL = process.argv.map(matchProtocolURL).find(Boolean) ?? null;

// app.on("window-all-closed", () => {
//   if (process.platform !== PLATFORM_MACOS) {
//       app.quit();
//   }
// });

app.on("window-all-closed", () => {
    // Intentionally left blank: Buttercup keeps running in the system tray when
    // all windows are closed, so we don't call app.quit() here.
});

// Quitting drops vault changes that couldn't be saved: ask first (#1230)
let __quitConfirmed = false;
let __confirmingQuit = false;
app.on("before-quit", (event) => {
    if (__quitConfirmed || getUnsavedSourceIDs().length === 0) return;
    event.preventDefault();
    if (__confirmingQuit) return;
    __confirmingQuit = true;
    confirmUnsavedChanges("quit")
        .then((confirmed) => {
            if (!confirmed) return;
            __quitConfirmed = true;
            app.quit();
        })
        .catch((err) => logErr("Failed checking for unsaved changes before quitting", err))
        .finally(() => {
            __confirmingQuit = false;
        });
});

app.on("activate", () => {
    openMainWindow();
});

// **
// ** App protocol handling
// **

app.on("second-instance", async (event, args) => {
    await openMainWindow();
    // Protocol URL for Linux/Windows
    const protocolURL = args.map(matchProtocolURL).find(Boolean);
    if (protocolURL) {
        handleProtocolCall(protocolURL);
    }
});
app.on("open-url", (e, url) => {
    // Protocol URL for MacOS
    if (matchProtocolURL(url)) {
        handleProtocolCall(url);
    }
});

// **
// ** Boot
// **

app.whenReady()
    .then(() => {
        logInfo("Application ready");
        initialiseElectronRemote();
    })
    .then(() => initialise())
    .then(async () => {
        await ensureLinuxProtocolHandler();
        for (const scheme of ACCEPTED_PROTOCOLS) {
            const protocol = scheme.replace("://", "");
            if (!app.isDefaultProtocolClient(protocol)) {
                logInfo(`Registering protocol: ${protocol}`);
                if (!app.setAsDefaultProtocolClient(protocol)) {
                    logErr(`Failed registering protocol: ${protocol}`);
                }
            } else {
                logInfo(`Protocol already registered: ${protocol}`);
            }
        }
    })
    .then(async () => {
        const preferences = await getConfigValue("preferences");
        const autostarted = wasAutostarted();
        // A launch-time protocol URL (e.g. an auth callback) needs a window to
        // receive it, so force the window open even for otherwise-hidden starts.
        if (
            !initialProtocolURL &&
            (!shouldShowMainWindow() || preferences.startMode === AppStartMode.HiddenAlways)
        ) {
            logInfo("Not opening initial window: disabled by CL or preferences");
            return;
        } else if (
            !initialProtocolURL &&
            autostarted &&
            preferences.startMode === AppStartMode.HiddenOnBoot
        ) {
            logInfo("Not opening initial window: disabled for autostart");
            return;
        }
        await openMainWindow();
        if (initialProtocolURL) {
            logInfo("Handling protocol URL from launch arguments");
            handleProtocolCall(initialProtocolURL);
        }
    })
    .catch((err) => {
        logErr(err);
        app.quit();
    });
