import { Layerr } from "layerr";
import { naiveClone } from "../../shared/library/clone";
import { AppStartMode, Config } from "../types";

export type ConfigMigration = [name: string, migration: (config: Config) => Config | null];

/**
 * File host keys made before this version came from `Math.random` (secure-file-host
 * before its fix, B-546). The key is dropped once, so a new one is generated from
 * `crypto.randomInt`; browser extensions have to pair again.
 */
export const FILE_HOST_KEY_VERSION = 2;

const MIGRATIONS: Array<ConfigMigration> = [
    [
        "fileHostKeyRandom",
        (config: Config) => {
            if (config.fileHostKeyVersion === FILE_HOST_KEY_VERSION) {
                return null; //  No change
            }
            return {
                ...config,
                fileHostKey: null,
                fileHostKeyVersion: FILE_HOST_KEY_VERSION
            };
        }
    ],
    [
        "startInBackground",
        (config: Config) => {
            if (
                config.preferences &&
                typeof config.preferences["startInBackground"] === "boolean"
            ) {
                const prefs = { ...config.preferences };
                prefs.startMode = config.preferences["startInBackground"]
                    ? AppStartMode.HiddenAlways
                    : AppStartMode.None;
                delete prefs["startInBackground"];
                return {
                    ...config,
                    preferences: prefs
                };
            }
            return null; //  No change
        }
    ]
];

export function runConfigMigrations(config: Config): [Config, changed: boolean] {
    let current = naiveClone(config),
        changed = false;
    for (const [name, execute] of MIGRATIONS) {
        try {
            const result = execute(current);
            if (result !== null) {
                changed = true;
                current = result;
            }
        } catch (err) {
            throw new Layerr(err, `Failed executing config migration: ${name}`);
        }
    }
    return [current, changed];
}
