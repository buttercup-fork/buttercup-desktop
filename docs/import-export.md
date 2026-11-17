# Import and export

Both work on the current vault, which must be unlocked: **Buttercup → Current Vault → Import** or **Export**.

## Import

Import adds the entries and groups from another password manager's export file to the current vault. Nothing already in the vault is removed. Choose the format, then the file:

| Menu item | File | How to get it |
|---|---|---|
| **Bitwarden (JSON)** | `.json` | Bitwarden's export in JSON format, **unencrypted**. An encrypted Bitwarden export is refused with a message. |
| **Buttercup (CSV)** | `.csv` | Buttercup's own CSV export (see below). |
| **CSV (CSV)** | `.csv` | A plain CSV with a header row. Columns read: `name` or `title`, `username`, `password`, `url`; other columns are ignored. |
| **KeePass (XML)** | `.xml` | KeePass 2: File → Export → KeePass XML (2.x). |
| **KeePassXC (CSV)** | `.csv` | KeePassXC: Database → Export → CSV File. Keeps the group tree, notes and OTP codes. |
| **Lastpass (CSV)** | `.csv` | LastPass's CSV export. |
| **1Password (1PIF)** | `.1pif` | Older 1Password versions. |
| **1Password (1PUX)** | `.1pux` | 1Password 8 (and 1Password 7 on Windows and Mac). One group per 1Password vault; attachments are not imported. |

To import into a separate area, create an empty vault first and import there, then move what you want.

**Delete the export file afterwards.** Every export file from another password manager holds your passwords in plain text. Delete it, and empty the trash/recycle bin, once the import worked.

## Export

**Export** writes the current vault to a **Buttercup CSV** file. Use it to move to another app or to keep a readable copy somewhere safe.

Before you choose the file, Buttercup warns you: **the CSV file holds every password in the vault as plain, unencrypted text.** Anyone who can open the file can read them. Choose **Export** only if you mean it.

- On Linux, the file is readable by your user account only. On Windows it gets the permissions of the folder you save it in, so save it somewhere only you can reach, not in a shared folder.
- The file opens in Excel and other spreadsheets with accented characters intact.
- It keeps each entry's type, fields and group, so importing it again with **Buttercup (CSV)** gives you the same entries back.
- Attachments are not included.

Store an export somewhere safe, for example an encrypted drive, and delete it when you no longer need it. To keep an encrypted copy instead, copy the `.bcup` vault file itself: it stays protected by the master password.
