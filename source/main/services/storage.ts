import path from "path";
import envPaths from "env-paths";
import { FileStorage } from "../library/FileStorage";
import { VaultSourceID } from "buttercup";
import { getPortableHomeDir, isPortable } from "../library/portability";
import { copyAppData } from "../library/appData";

interface EnvPaths {
    data: string;
    config: string;
    cache: string;
    log: string;
    temp: string;
}

function getDefaultEnvPaths(): EnvPaths {
    const { data, config, cache, log, temp } = envPaths("Buttercup");
    return { data, config, cache, log, temp };
}

function getHomeEnvPaths(homeDir: string): EnvPaths {
    return {
        data: path.join(homeDir, "data"),
        config: path.join(process.env.BUTTERCUP_CONFIG_DIR || homeDir, "config"),
        cache: path.join(homeDir, "cache"),
        log: path.join(homeDir, "log"),
        temp: path.join(process.env.BUTTERCUP_TEMP_DIR || homeDir, "temp")
    };
}

// One folder for all app data: BUTTERCUP_HOME_DIR, or the portable app's data
// folder next to its exe (#1254). Otherwise the OS default locations.
const HOME_DIR: string | null =
    process.env.BUTTERCUP_HOME_DIR || (isPortable() ? getPortableHomeDir() : null);
const __envPaths: EnvPaths = HOME_DIR ? getHomeEnvPaths(HOME_DIR) : getDefaultEnvPaths();

const CONFIG_PATH = path.join(__envPaths.config, "desktop.config.json");
export const LOG_FILENAME = "buttercup-desktop.log";
export const LOG_PATH = path.join(__envPaths.log, LOG_FILENAME);
export const VAULTS_BACKUP_PATH = path.join(__envPaths.data, "backup");
const VAULTS_CACHE_PATH = path.join(__envPaths.temp, "vaults-offline.cache.json");
const VAULTS_PATH = path.join(__envPaths.data, "vaults.json");
const VAULT_SETTINGS_PATH = path.join(__envPaths.config, "vault-config-SOURCEID.json");

let __configStorage: FileStorage = null,
    __vaultStorage: FileStorage = null,
    __vaultCacheStorage: FileStorage = null;

/**
 * The folder holding all app data, or null when the OS default locations are
 * used. Electron's own profile goes in its "electron" subfolder.
 */
export function getHomeDir(): string | null {
    return HOME_DIR;
}

/**
 * First start of the portable app with its own data folder: copy the vault list
 * and settings from the default locations, where earlier versions kept them.
 * @returns The copied files
 */
export function copyAppDataToPortableHome(): Array<string> {
    if (!isPortable() || process.env.BUTTERCUP_HOME_DIR) return [];
    return copyAppData(getDefaultEnvPaths(), __envPaths);
}

export function getConfigPath(): string {
    return CONFIG_PATH;
}

export function getConfigStorage(): FileStorage {
    if (!__configStorage) {
        __configStorage = new FileStorage(CONFIG_PATH);
    }
    return __configStorage;
}

export function getVaultCacheStorage(): FileStorage {
    if (!__vaultCacheStorage) {
        __vaultCacheStorage = new FileStorage(VAULTS_CACHE_PATH);
    }
    return __vaultCacheStorage;
}

export function getVaultSettingsPath(sourceID: VaultSourceID): string {
    return VAULT_SETTINGS_PATH.replace("SOURCEID", sourceID);
}

export function getVaultSettingsStorage(sourceID: VaultSourceID): FileStorage {
    return new FileStorage(getVaultSettingsPath(sourceID));
}

export function getVaultStorage(): FileStorage {
    if (!__vaultStorage) {
        __vaultStorage = new FileStorage(VAULTS_PATH);
    }
    return __vaultStorage;
}

export function getVaultStoragePath(): string {
    return VAULTS_PATH;
}
