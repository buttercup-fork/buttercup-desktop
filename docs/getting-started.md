# Your first vault

## Add or create a vault

On first start Buttercup shows **A Fresh Start** with an **Add Vault** button (later: **Buttercup → Vaults → Add New**, or the **+** next to the vault tabs).

1. Choose where the vault lives: **File**, **Dropbox**, **Google Drive** or **WebDAV**. See [Storing a vault](vault-storage.md) for each.
2. Pick an existing vault file, or create a new one (for a local file: **Create New**, then choose a folder and file name).
3. Enter the master password. For a new vault, this sets it.

The vault opens in its own tab. Right-click a tab to lock, unlock or remove the vault, or to open its **Vault settings**. Removing a vault only takes it off the list; the file is not deleted.

## The master password

The master password is the only key to the vault. Buttercup never stores it and can't recover it.

When you set a password (new vault or a password change) it must:

- be at least **8 characters**; 15 or more is better,
- not be one of the 10,000 most common passwords.

Any characters are allowed, including spaces, and the password is used exactly as you type it. A few unrelated words make a strong password that is easy to type.

Vaults you already have keep their password and open as before.

**Change it** in **Vault settings → Password** (the vault must be unlocked): type the current password and the new one twice. Buttercup first saves a backup of the vault, still locked with the old password, and shows where. Every other app or device that opens this vault (the browser extension, other computers, a phone) then needs the new password.

## Groups and entries

The left column holds **Groups**. Right-click a group to add a group inside it (**Add New Group**), rename it, move it, or move it to the Trash. The middle column lists the entries of the selected group, with a **Filter...** box. **New Entry** adds one, and you pick its type: **Login**, **Website**, **Credit/Bank Card**, **Note** or **SSH Key**.

- **Edit** an entry, change fields, **Save**. **Add Custom Field** adds your own fields; a field's type can be **Text**, **Note**, **Password** or **OTP**.
- **OTP** fields show the current one-time code. Next to an OTP field, the scan button reads a QR code from an image on the clipboard (take a screenshot of the QR code first) or from a file.
- **Attachments:** drag files onto an entry. They are stored encrypted in the vault.
- **Previous values:** the history button next to a field lists its earlier values.
- **Several entries at once:** Ctrl+click adds or removes an entry, Shift+click selects a range; right-click to move them all to a group or to the Trash.
- Deleted entries go to the **Trash** first. **Empty Trash** removes them for good.

## Copy and search

- Click the copy button next to a field, or right-click the field. With an entry selected in the list, **Ctrl+B** copies the username and **Ctrl+C** the password.
- **Ctrl+F** searches the current vault.
- Ctrl+click a URL to open it in your browser.

Copied values are cleared from the clipboard after 30 seconds on new installs. On Windows, copies are kept out of clipboard history (Win+V) and cloud clipboard. See [Security settings](security-settings.md#clipboard).

## The password generator

When editing a password field, the generator button makes a new one: choose **Characters** (with the character sets to use) or **Words**, then **Use This** or **Copy**. If no password can be made with the chosen options, it says why and offers nothing until you change them.

## Lock

**Ctrl+L** locks the current vault, **Ctrl+Alt+L** locks all of them. If changes couldn't be saved yet, Buttercup asks first: **Save and Lock** tries again, **Lock Anyway** discards them, **Cancel** keeps the vault open.
