# Troubleshooting

## "Wrong password. Try again."

The password doesn't open this vault. Check Caps Lock and the keyboard layout. The password is used exactly as typed, including spaces and accents. Nobody can recover a forgotten master password; a backup or an exported copy is the only way back to its contents.

## "The vault file is incomplete or damaged"

The file was probably cut off while it was being saved (power cut, a sync service copying it halfway). Buttercup offers **Restore Last Saved Copy**. See [A damaged vault](vault-storage.md#a-damaged-vault). Other sources: your sync service's file history, or the local backups (Vault settings → Backup).

## "That file isn't a Buttercup vault."

The file you chose isn't a vault (for example a CSV export or a file from another app). Vault files usually end in `.bcup`.

## "This vault is already in Buttercup as …"

Each vault can be in the list only once. Open the one with the name the message shows.

## Google Drive: can't sign in, or asked to sign in every week

This project's Google sign-in app is still in Google's Testing mode (see [Google Drive](vault-storage.md#google-drive)): only accounts added as test users can sign in, and the sign-in lasts 7 days. Vaults added with the original Buttercup ask you to sign in once more.

If your vault file doesn't show up in the Drive list, use **Upload Vault** to copy it in.

## Dropbox sign-in doesn't finish

The sign-in happens in a separate Buttercup window. Finish it there, not in your browser. If the window was closed, start **Add Vault → Dropbox** again.

## WebDAV: "Unencrypted connection"

The address starts with `http://` and points to another computer, so your WebDAV password would cross the network unencrypted. Use the `https://` address if your server has one. Otherwise tick **Allow unencrypted connection** if you accept that risk. See [WebDAV](vault-storage.md#webdav).

## The browser extension can't connect

See [Browser extension → If it doesn't connect](browser-extension.md#if-it-doesnt-connect).

## Vaults don't lock with the screen on Linux

Install `dbus-bin` (`sudo apt install dbus-bin`) and restart Buttercup. Some desktops don't report the screen lock at all; then vaults still lock on sleep and with **Lock vaults after time**.

## The AppImage won't start, or mentions the sandbox (Ubuntu 24.04 and later)

Use the `.deb` package. See [Install → Linux](install.md#linux).

## Windows: "Windows protected your PC"

The builds aren't code-signed yet. [Check the hash](install.md#check-the-download-first) first, then **More info → Run anyway**.

## Changes weren't saved

If a vault's file or server can't be reached, Buttercup keeps the changes in memory and asks before you lock or quit: **Save and Lock** / **Save and Quit** tries again. If you choose **Lock Anyway** or **Quit Anyway**, the unsaved changes are lost.

## Logs

When you report a problem, the log helps. It is `buttercup-desktop.log` in:

- Windows: `%LOCALAPPDATA%\Buttercup-nodejs\Log`
- Windows portable: `Buttercup-data\log`, next to the `.exe`
- Linux: `~/.local/state/Buttercup-nodejs`

The log records vault names, file paths and errors. Read it before you share it, and remove anything you'd rather keep private.

## Reporting a problem

Open an issue on this repository with your Buttercup version, operating system, what you did and what happened. Never attach your real vault or share its password. For security problems, follow the security policy instead of opening a public issue.
