# Storing a vault

A vault is one encrypted file. Where it lives decides how you reach it from other devices. Whatever you choose, the storage provider only ever sees the encrypted file: your entries, and your master password, never leave your computer unencrypted.

Add a vault with **Buttercup → Vaults → Add New** and pick a type.

## File

The vault is a `.bcup` file on your computer, or in a folder that a sync service keeps in step (for example a cloud drive's desktop folder).

- **Load Existing** opens a vault file. The file dialog also offers **All Files** for a vault with another extension; a file that isn't a Buttercup vault is refused with a message.
- **Create New** asks where to save a new vault file.

Buttercup saves by writing a temporary file next to the vault and swapping it in once it is complete, so an interrupted save (power cut, a sync service copying the file mid-save) no longer leaves a broken vault.

If two devices change the same vault through a sync folder, Buttercup merges the changes when it saves. Avoid editing on two devices at exactly the same moment all the same.

## Dropbox

Choose **Dropbox**. A separate window opens for the Dropbox sign-in; after you allow access, pick a vault file or create one.

## Google Drive

Choose **Google Drive**, then **Authenticate**. Your browser opens Google's sign-in, and Google sends you back to Buttercup on this computer. Buttercup asks which level of access to use:

- an **open** setting lets Buttercup see all files and folders in your Drive;
- a **non-open** setting lets it see only files it created or opened before.

With the non-open setting, a vault made elsewhere (another app, an upload in the browser, or the original Buttercup app) doesn't show up. Use **Upload Vault** to copy a `.bcup` file from your computer into the Drive folder you're in; it is selected straight away. It is a copy: point your other devices at the new file.

> **Known limit (3.0.0):** this project's Google sign-in app is still in Google's *Testing* mode until Google approves it. Until then, only Google accounts added as test users can sign in, and they have to sign in again every 7 days. Local files, Dropbox and WebDAV are not affected. A vault added with the original Buttercup asks you to sign in once more.

If Google refuses to renew a sign-in, Buttercup asks you to sign in to Google again.

## WebDAV

For your own server or a service that offers WebDAV (Nextcloud, ownCloud and many NAS systems). Enter:

- **WebDAV Service**: the server's WebDAV address,
- **Username** and **Password** for that server.

Then pick a vault file or create one.

**Use `https`.** With a plain `http` address to another computer, your WebDAV username and password travel unencrypted and anyone on the same network can read them (the vault itself stays encrypted). Buttercup shows a warning and sends nothing until you tick **Allow unencrypted connection**. Addresses on this computer (`localhost`, `127.x.x.x`, `[::1]`) don't ask. A WebDAV vault added with `http` before version 3.0.0 asks once when you unlock it, and remembers your answer.

## Local backups

Each vault can keep backups on this computer: **Vault settings → Backup → Enable local backups**. Leave **Backup Path** empty for the default folder, or give a full path. A backup is written each time the vault is saved.

Turn this on for vaults that live only in the cloud or on a server. Buttercup also saves a backup before you change a master password, whether backups are on or not.

## A damaged vault

If a vault file is incomplete or damaged, Buttercup says so when you unlock it and offers **Restore Last Saved Copy**: the copy it kept from the last time the vault was opened or saved on this computer. Your password is checked against that copy first, and a damaged local file is kept in the backup folder before it is replaced. Changes saved on other devices after that copy are missing; the dialog says so.

Other ways back: your own copy of the file, your sync service's file history, or the local backups above.

## Removing a vault

Right-click the vault's tab → **Remove vault**. This only removes it from Buttercup's list; the vault file itself is not deleted.
