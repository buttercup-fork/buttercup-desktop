import path from "path";

const { PORTABLE_EXECUTABLE_APP_FILENAME, PORTABLE_EXECUTABLE_DIR } = process.env;

// Folder next to the portable exe that holds all of the app's data (#1254)
const PORTABLE_HOME_DIRNAME = "Buttercup-data";

export function getPortableExeDir(): string {
    return PORTABLE_EXECUTABLE_DIR;
}

export function getPortableHomeDir(): string {
    return path.join(getPortableExeDir(), PORTABLE_HOME_DIRNAME);
}

export function isPortable(): boolean {
    return !!PORTABLE_EXECUTABLE_APP_FILENAME;
}
