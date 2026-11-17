import { Layerr } from "layerr";
import { naiveClone } from "../../shared/library/clone";
import { AppStartMode, Config } from "../types";

export type ConfigMigration = [name: string, migration: (config: Config) => Config | null];

/**
 * Config keys of the Secure File Host (port 12821), removed in B-578 (D-046): its
 * stored key and the version marker of the earlier key migration (B-546).
 */
export const REMOVED_FILE_HOST_KEYS = ["fileHostKey", "fileHostKeyVersion"] as const;

/**
 * Marker for the one-time reset of paired browsers (B-800). 3.0.0 shares the settings
 * folder with earlier versions, whose browser connection could be paired from the
 * network or a web page (B-569 to B-571), and nothing else ever removes a pairing.
 */
export const BROWSER_PAIRINGS_RESET_KEY = "browserPairingsReset" as const;
const BROWSER_PAIRINGS_RESET_VERSION = 1;

const MIGRATIONS: Array<ConfigMigration> = [
    [
        "forgetEarlierBrowserPairings",
        (config: Config) => {
            if (config[BROWSER_PAIRINGS_RESET_KEY] === BROWSER_PAIRINGS_RESET_VERSION) {
                return null; //  No change
            }
            return {
                ...config,
                browserClients: {},
                [BROWSER_PAIRINGS_RESET_KEY]: BROWSER_PAIRINGS_RESET_VERSION
            };
        }
    ],
    [
        "removeFileHost",
        (config: Config) => {
            const present = REMOVED_FILE_HOST_KEYS.filter((key) =>
                Object.prototype.hasOwnProperty.call(config, key)
            );
            if (present.length === 0) {
                return null; //  No change
            }
            const updated: Record<string, unknown> = { ...config };
            for (const key of present) {
                delete updated[key];
            }
            return updated as unknown as Config;
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
