// The channels the window may use to talk to the main process. The window has no
// Node access (B-475): its preload script (source/preload) passes through only
// these, so a compromised page can't reach any other message channel. The
// ipcChannels test keeps this list and the renderer's calls in step.

// The window asks, the main process answers (ipcRenderer.invoke)
export const IPC_INVOKE_CHANNELS = [
    "attachment-add",
    "attachment-delete",
    "attachment-download",
    "attachment-get-data",
    "authenticate-3rd-party",
    "browser-access-code-clear",
    "change-source-master-password",
    "check-source-biometrics",
    "choose-qr-image-file",
    "choose-vault-file-upload",
    "convert-vault-format",
    "copied-into-clipboard",
    "get-app-environment",
    "get-biometric-source-password",
    "get-current-update",
    "get-dark-colors",
    "get-existing-vault-filename",
    "get-locale",
    "get-new-vault-filename",
    "get-ready-update",
    "get-selected-source",
    "get-site-icon",
    "get-vault-description",
    "get-vault-facade",
    "get-vault-settings",
    "google-auth-begin",
    "google-auth-complete",
    "install-update",
    "mute-current-update",
    "open-link",
    "read-clipboard-qr-image",
    "register-biometric-unlock",
    "save-source",
    "save-vault-facade",
    "search-single-vault",
    "set-reauth-google-tokens",
    "set-selected-source",
    "set-source-order",
    "set-sources-order",
    "set-vault-settings",
    "start-current-update",
    "toggle-auto-update",
    "trigger-user-presence",
    "unlock-source",
    "write-clipboard"
] as const;

// The window tells the main process (ipcRenderer.send)
export const IPC_SEND_CHANNELS = [
    "add-vault-config",
    "get-empty-vault",
    "get-preferences",
    "lock-source",
    "log",
    "remove-source",
    "update-vault-windows",
    "write-preferences"
] as const;

// The main process tells the window (ipcRenderer.on / once)
export const IPC_RECEIVE_CHANNELS = [
    "add-vault",
    "add-vault-config:reply",
    "browser-access-code",
    "browser-access-code-hide",
    "file-host-code",
    "get-empty-vault:reply",
    "get-preferences:reply",
    "google-reauth",
    "lock-source:reply",
    "notify-error",
    "notify-success",
    "open-about",
    "open-biometric-registration",
    "open-preferences",
    "open-search",
    "open-source",
    "route",
    "set-busy",
    "source-updated",
    "theme-updated",
    "unlock-vault",
    "unlock-vault-open",
    "update-available",
    "update-downloaded",
    "update-error",
    "update-progress",
    "vaults-list"
] as const;

export type IpcInvokeChannel = (typeof IPC_INVOKE_CHANNELS)[number];
export type IpcSendChannel = (typeof IPC_SEND_CHANNELS)[number];
export type IpcReceiveChannel = (typeof IPC_RECEIVE_CHANNELS)[number];
