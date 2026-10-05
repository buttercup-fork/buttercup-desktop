import { app, Menu } from "electron";
import { VaultSourceID, VaultSourceStatus } from "buttercup";
import { getSourceDescriptions } from "../services/buttercup";
import { lockAllSourcesAfterConfirming, lockSourceAfterConfirming } from "./unsaved";
import { closeWindows, getMainWindow, openMainWindow } from "../services/windows";
import { getConfigValue, setConfigValue } from "../services/config";
import { getLastSourceID } from "../services/lastVault";
import {
    disableSourceBiometricUnlock,
    sourceEnabledForBiometricUnlock,
    supportsBiometricUnlock
} from "../services/biometrics";
import { IMPORTERS, startImport } from "../services/import";
import { exportVaultSource } from "../services/export";
import { handleConfigUpdate } from "./config";
import { t } from "../../shared/i18n/trans";
import { isOSX } from "../../shared/library/platform";
import { getIconForProvider, getNativeImageMenuIcon } from "../library/icons";
import { logErr } from "../library/log";
import { VaultSourceDescription } from "../types";

/**
 * The vault the "Current Vault" items act on, read when one is clicked. The
 * menu is rebuilt in the background after switching vaults, so the vault it
 * was built for can be the previous one (B-454).
 */
function getCurrentSource(): VaultSourceDescription | null {
    const sourceID = getLastSourceID();
    return getSourceDescriptions().find((source) => source.id === sourceID) || null;
}

function getCurrentUnlockedSourceID(): VaultSourceID | null {
    const source = getCurrentSource();
    return source && source.state === VaultSourceStatus.Unlocked ? source.id : null;
}

async function getContextMenu(): Promise<Menu> {
    const sources = getSourceDescriptions();
    const lastSourceID = getLastSourceID();
    const lastSource = sources.find((source) => source.id === lastSourceID) || null;
    const preferences = await getConfigValue("preferences");
    const currentVaultPrefix = [];
    const biometricsSupported = await supportsBiometricUnlock();
    let biometricsEnabled = false,
        lastSourceUnlocked = false;
    if (lastSource) {
        lastSourceUnlocked = lastSource.state === VaultSourceStatus.Unlocked;
        currentVaultPrefix.push(
            {
                label: lastSource.name,
                enabled: false,
                icon: await getNativeImageMenuIcon(getIconForProvider(lastSource.type))
            },
            { type: "separator" }
        );
        biometricsEnabled = await sourceEnabledForBiometricUnlock(lastSource.id);
    }
    return Menu.buildFromTemplate([
        {
            label: "Buttercup",
            submenu: [
                {
                    label: t("app-menu.about"),
                    click: async () => {
                        const window = await openMainWindow();
                        window.webContents.send("open-about");
                    }
                },
                {
                    label: t("app-menu.preferences"),
                    click: async () => {
                        const window = await openMainWindow();
                        window.webContents.send("open-preferences");
                    }
                },
                { type: "separator" },
                {
                    label: t("app-menu.close-window"),
                    click: () => closeWindows()
                },
                { label: t("app-menu.quit"), role: "quit" }
            ]
        },
        {
            label: t("app-menu.vaults"),
            submenu: [
                {
                    label: t("app-menu.add-new-vault"),
                    click: async () => {
                        const window = await openMainWindow();
                        window.webContents.send("add-vault");
                    }
                },
                { type: "separator" },
                {
                    label: t("app-menu.unlock-vault"),
                    submenu: sources.map((source) => ({
                        label: source.name,
                        enabled: source.state === VaultSourceStatus.Locked,
                        click: async () => {
                            const window = await openMainWindow(`/source/${source.id}`);
                            window.webContents.send("unlock-vault", source.id);
                        }
                    }))
                },
                {
                    label: t("app-menu.lock-all"),
                    accelerator: isOSX() ? "Cmd+Alt+L" : "Ctrl+Alt+L",
                    click: () => lockAllSourcesAfterConfirming()
                }
            ]
        },
        {
            label: t("app-menu.current"),
            submenu: [
                ...currentVaultPrefix,
                {
                    label: t("app-menu.search"),
                    enabled: !!lastSource,
                    accelerator: isOSX() ? "Cmd+F" : "Ctrl+F",
                    click: async () => {
                        const window = await openMainWindow();
                        window.webContents.send("open-search");
                    }
                },
                { type: "separator" },
                {
                    label: t("app-menu.biometrics"),
                    enabled: !!lastSource && biometricsSupported,
                    type: "checkbox",
                    checked: biometricsEnabled,
                    click: async () => {
                        const sourceID = getCurrentSource()?.id;
                        if (!sourceID) return;
                        if (await sourceEnabledForBiometricUnlock(sourceID)) {
                            const mainWindow = getMainWindow();
                            try {
                                await disableSourceBiometricUnlock(sourceID);
                                if (mainWindow) {
                                    mainWindow.webContents.send(
                                        "notify-success",
                                        t("notification.biometrics-disabled")
                                    );
                                }
                            } catch (err) {
                                logErr(`Failed disabling biometrics for source: ${sourceID}`, err);
                                if (mainWindow) {
                                    mainWindow.webContents.send(
                                        "notify-error",
                                        t("notification.error.biometrics-disable-failed", {
                                            error: err.message
                                        })
                                    );
                                }
                            }
                        } else {
                            const window = await openMainWindow(`/source/${sourceID}`);
                            window.webContents.send("open-biometric-registration");
                        }
                    }
                },
                { type: "separator" },
                {
                    label: t("app-menu.lock-current-vault"),
                    enabled: !!lastSource && lastSourceUnlocked,
                    accelerator: isOSX() ? "Cmd+L" : "Ctrl+L",
                    click: async () => {
                        const sourceID = getCurrentUnlockedSourceID();
                        if (!sourceID) return;
                        return lockSourceAfterConfirming(sourceID);
                    }
                },
                { type: "separator" },
                {
                    label: t("app-menu.import"),
                    enabled: !!lastSource && lastSourceUnlocked,
                    submenu: IMPORTERS.map(([importer, extension, importerConstructor]) => ({
                        label: `${importer} (${extension.toUpperCase()})`,
                        enabled: !!lastSource && lastSourceUnlocked,
                        click: () => {
                            const sourceID = getCurrentUnlockedSourceID();
                            if (!sourceID) return;
                            startImport(sourceID, importer, extension, importerConstructor).catch(
                                async (err) => {
                                    logErr("Import failed", err);
                                    const window = await openMainWindow();
                                    window.webContents.send("notify-error", err.message);
                                }
                            );
                        }
                    }))
                },
                {
                    label: t("app-menu.export"),
                    enabled: !!lastSource && lastSourceUnlocked,
                    click: async () => {
                        const sourceID = getCurrentUnlockedSourceID();
                        if (!sourceID) return;
                        await exportVaultSource(sourceID);
                    }
                }
            ]
        },
        {
            label: t("app-menu.connection"),
            submenu: [
                {
                    label: t("app-menu.enable-secure-file-host"),
                    type: "checkbox",
                    checked: preferences.fileHostEnabled,
                    click: async () => {
                        const prefs = await getConfigValue("preferences");
                        prefs.fileHostEnabled = !prefs.fileHostEnabled;
                        await setConfigValue("preferences", prefs);
                        await updateAppMenu();
                        await handleConfigUpdate(prefs);
                    }
                }
            ]
        },
        {
            label: t("app-menu.edit"),
            role: "editMenu"
        },
        // Release builds get no developer tools (#712): Electron's stock View
        // menu brings Reload and Toggle Developer Tools (Ctrl+Shift+I) with it,
        // so it's only used in development, next to the Debug menu.
        ...(app.isPackaged
            ? [
                  {
                      label: t("app-menu.view"),
                      submenu: [
                          { role: "resetZoom" as const },
                          { role: "zoomIn" as const },
                          { role: "zoomOut" as const },
                          { type: "separator" as const },
                          { role: "togglefullscreen" as const }
                      ]
                  }
              ]
            : [
                  {
                      label: t("app-menu.view"),
                      role: "viewMenu" as const
                  },
                  {
                      label: t("app-menu.debug"),
                      submenu: [{ label: t("app-menu.devtool"), role: "toggleDevTools" as const }]
                  }
              ])
    ]);
}

export async function updateAppMenu() {
    const menu = await getContextMenu();
    Menu.setApplicationMenu(menu);
}
