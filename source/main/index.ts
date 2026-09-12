import { app } from "electron";
import { initialize as initialiseElectronRemote } from "@electron/remote/main";
import "./ipc";
import { initialise } from "./services/init";
import { openMainWindow } from "./services/windows";
import { handleProtocolCall, matchProtocolURL } from "./services/protocol";
import { ensureLinuxProtocolHandler } from "./services/linuxProtocol";
import { getConfigValue } from "./services/config";
import { shouldShowMainWindow, wasAutostarted } from "./services/arguments";
import { logErr, logInfo } from "./library/log";
import { ACCEPTED_PROTOCOLS } from "./symbols";
import { AppStartMode } from "./types";

logInfo("Application starting");

// Windows-only GPU-compositor workaround: on some Windows GPU driver / Chromium
// combinations, the window leaves stale pixels between repaints - most visibly a
// line between the menu bar and the vault-tab strip that only clears wherever the
// cursor hovers. Confirmed fixed by disabling GPU compositing (see UPSTREAM-ISSUES.md,
// "Fork-discovered" table). Must run before the app is ready.
if (process.platform === "win32") {
    app.commandLine.appendSwitch("disable-gpu-compositing");
}

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
