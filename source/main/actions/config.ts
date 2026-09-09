import { logErr, logInfo } from "../library/log";
import { applyCurrentTheme } from "../services/theme";
import { getOSLocale } from "../services/locale";
import { changeLanguage, t } from "../../shared/i18n/trans";
import { getLanguage } from "../../shared/library/i18n";
import { startFileHost, stopFileHost } from "../services/fileHost";
import { setStartWithSession } from "../services/launch";
import { start as startBrowserAPI, stop as stopBrowserAPI } from "../services/browser/index";
import { setConfigValue } from "../services/config";
import { startAutoVaultLockTimer } from "../services/autoLock";
import { getMainWindow } from "../services/windows";
import { Preferences } from "../types";

export async function handleConfigUpdate(preferences: Preferences) {
    logInfo("Config updated");
    applyCurrentTheme(preferences);
    const locale = await getOSLocale();
    logInfo(` - System locale detected: ${locale}`);
    const language = getLanguage(preferences, locale);
    logInfo(` - Language updated: ${language}`);
    await changeLanguage(language);
    logInfo(
        ` - Auto clear clipboard: ${
            preferences.autoClearClipboard ? preferences.autoClearClipboard + "s" : "Off"
        }`
    );
    logInfo(
        ` - Lock vaults after: ${
            preferences.lockVaultsAfterTime ? preferences.lockVaultsAfterTime + "s" : "Off"
        }`
    );
    logInfo(` - Background start: ${preferences.startMode}`);
    logInfo(
        ` - Start with session launch: ${preferences.startWithSession ? "Enabled" : "Disabled"}`
    );
    await setStartWithSession(preferences.startWithSession);
    // Pick up a changed `lockVaultsAfterTime` immediately.
    await startAutoVaultLockTimer();
    logInfo(` - File host: ${preferences.fileHostEnabled ? "Enabled" : "Disabled"}`);
    if (preferences.fileHostEnabled) {
        try {
            await startBrowserAPI();
            await startFileHost();
        } catch (err) {
            logErr("Failed enabling browser access / file host", err);
            // Roll the preference back so the UI doesn't show it as enabled while
            // nothing is listening (e.g. the port is already in use).
            await stopBrowserAPI().catch(() => {});
            await stopFileHost().catch(() => {});
            preferences.fileHostEnabled = false;
            await setConfigValue("preferences", preferences);
            const window = getMainWindow();
            if (window) {
                const detail =
                    (err as NodeJS.ErrnoException)?.code === "EADDRINUSE"
                        ? t("notification.error.browser-access-port-in-use")
                        : (err as Error)?.message || t("notification.error.unknown-error");
                window.webContents.send(
                    "notify-error",
                    `${t("notification.error.browser-access-failed")}: ${detail}`
                );
            }
        }
    } else {
        await stopBrowserAPI();
        await stopFileHost();
    }
}
