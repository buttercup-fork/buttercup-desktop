import { AppStartMode, Preferences, ThemeSource, VaultSettingsLocal } from "./types";

export const COLOURS = {
    DARK_PRIMARY: "#292C33",
    DARK_SECONDARY: "#31353D",
    BRAND_PRIMARY: "#00B7AC",
    BRAND_PRIMARY_DARKER: "#179E94",
    GRAY_LIGHT: "#F5F7FA",
    GRAY_LIGHT_DARKER: "#E4E9F2",
    GRAY_DARK: "#777",
    GRAY: "#E4E9F2",
    RED: "#EB5767",
    RED_DARKER: "#E84054",
    BLACK_5: "rgba(0,0,0,.05)",
    BLACK_10: "rgba(0,0,0,.10)",
    BLACK_20: "rgba(0,0,0,.20)",
    BLACK_25: "rgba(0,0,0,.25)",
    BLACK_35: "rgba(0,0,0,.35)",
    WHITE_50: "rgba(255,255,255,.50)",
    LEVEL_4: "#5CAB7D",
    LEVEL_3: "#8FBC94",
    LEVEL_2: "#FFBC42",
    LEVEL_1: "#E71D36",
    LEVEL_0: "#E71D36"
};

export const APP_ID = "net.codekunde.buttercup";
export const ATTACHMENTS_MAX_SIZE = 20 * 1024 * 1024;
export const DEFAULT_LANGUAGE = "en";
export const DROPBOX_CLIENT_ID = "5fstmwjaisrt06t";
export const GOOGLE_AUTH_TIMEOUT = 5 * 60 * 1000;
const GOOGLE_DRIVE_BASE_SCOPES = ["email", "profile"];
export const GOOGLE_DRIVE_SCOPES_STANDARD = [
    ...GOOGLE_DRIVE_BASE_SCOPES,
    "https://www.googleapis.com/auth/drive.file" // Per-file access
];
// This fork's own Google OAuth client ("Buttercup (CodeKunde)", Desktop app type).
// Sign-in uses a loopback redirect (http://127.0.0.1:<port>), which Google only
// allows for Desktop app clients. Google treats a Desktop app's secret as public:
// it ships inside the app. Refresh tokens are tied to the client, so Google Drive
// vaults added with the previous (upstream) client ask to sign in again once.
export const GOOGLE_CLIENT_ID =
    "333058351404-ojn6jj9mqsg4uf0ge70vg0uu2sbgn8ml.apps.googleusercontent.com";
export const GOOGLE_CLIENT_SECRET = "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";
export const ICON_UPLOAD = "upload";

export const PREFERENCES_DEFAULT: Preferences = {
    autoClearClipboard: 30, // seconds, or false for never
    fileHostEnabled: false,
    language: null,
    lockVaultsAfterTime: false, // seconds
    lockVaultsOnSystemLock: true,
    lockVaultsOnWindowClose: false,
    prereleaseUpdates: false,
    startMode: AppStartMode.None,
    startWithSession: false,
    uiTheme: ThemeSource.System
};

export const VAULT_SETTINGS_DEFAULT: VaultSettingsLocal = {
    localBackup: false,
    localBackupLocation: null,
    biometricForcePasswordMaxInterval: "",
    biometricForcePasswordCount: "",
    biometricLastManualUnlock: +Infinity,
    biometricUnlockCount: 0
};
