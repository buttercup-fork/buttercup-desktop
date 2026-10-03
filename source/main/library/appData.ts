import fs from "fs";
import path from "path";

interface AppDataPaths {
    config: string;
    data: string;
}

const CONFIG_FILENAME = "desktop.config.json";
const VAULT_SETTINGS_PATTERN = /^vault-config-.+\.json$/;
const VAULTS_FILENAME = "vaults.json";

/**
 * Copy the app settings, per-vault settings and vault list from one data
 * location to another, if the target has neither settings nor a vault list
 * yet. The source is left untouched; backups and caches aren't copied.
 * @returns The copied files (target paths)
 */
export function copyAppData(from: AppDataPaths, to: AppDataPaths): Array<string> {
    if (
        fs.existsSync(path.join(to.config, CONFIG_FILENAME)) ||
        fs.existsSync(path.join(to.data, VAULTS_FILENAME))
    ) {
        return [];
    }
    const configFiles = fs.existsSync(from.config)
        ? fs
              .readdirSync(from.config)
              .filter((name) => name === CONFIG_FILENAME || VAULT_SETTINGS_PATTERN.test(name))
        : [];
    const copies = [
        ...configFiles.map((name) => [path.join(from.config, name), path.join(to.config, name)]),
        [path.join(from.data, VAULTS_FILENAME), path.join(to.data, VAULTS_FILENAME)]
    ].filter(([source]) => fs.existsSync(source));
    return copies.map(([source, target]) => {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
        return target;
    });
}
