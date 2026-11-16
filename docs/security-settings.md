# Security settings

Open **Buttercup → Preferences**. The settings below are under **Security** unless another section is named. Each vault also has its own **Vault settings** (right-click its tab).

## Lock vaults after time

Locks all vaults after a period without activity in the Buttercup window (moving the mouse over it or typing in it): from 30 seconds to 1 day, or **Off**. It is off by default. Turn it on, for example at 5 or 15 minutes.

The timer waits while you are editing an entry, so you aren't locked out halfway through. Using the browser extension doesn't count as activity.

## Lock vaults when the computer locks

**Lock on screen lock or sleep**: on by default. Vaults lock when you lock the screen (Win+L) or the computer goes to sleep.

On Linux this needs the `dbus-monitor` program (package `dbus-bin` on Debian and Ubuntu) and a desktop that reports the screen lock (GNOME, KDE, Cinnamon, MATE, Xfce). Without `dbus-monitor`, vaults still lock on sleep, and the log says the screen lock isn't watched.

## Lock vaults if vault window closed

**Lock on close**: off by default. Closing the window keeps Buttercup running in the notification area with your vaults unlocked (so the browser extension keeps working). Turn this on if you'd rather close the window and have everything locked.

## When a lock meets unsaved changes

If a vault has changes that couldn't be saved yet (its file or server was unreachable), a lock you start yourself asks first: **Save and Lock**, **Lock Anyway** or **Cancel**. An automatic lock (timer, screen lock, sleep) tries one more save, then locks anyway and tells you if changes were lost.

## Clipboard

**Automatically clear clipboard**: copied values are cleared after the time you pick (15 seconds to 30 minutes, or **Off**). New installs clear after 30 seconds.

Clipboard history tools keep their own copy the moment you copy, and Buttercup can't clear that copy:

- **Windows:** Buttercup marks everything it copies as confidential, so Windows clipboard history (Win+V) and cloud clipboard sync don't keep it. Third-party clipboard managers may ignore that mark.
- **Linux:** clipboard managers such as Klipper or GPaste keep copies. Turn their history off, or exclude Buttercup in them.

## Browser access

**Preferences → Connectivity → Enable browser access**: off by default. Only needed for the browser extension. See [Browser extension](browser-extension.md).

## Per-vault settings

Right-click a vault's tab → **Vault settings** (the vault must be unlocked):

- **Password**: change the master password. See [Your first vault](getting-started.md#the-master-password).
- **Backup**: local backups when saving. See [Storing a vault](vault-storage.md#local-backups).
- **Format**: an older vault in **Format A** can be upgraded to **Format B**, the current format. The upgrade can't be undone: make a backup first, and make sure every app and device that opens this vault is up to date.

## Other things that protect you

- The app checks for new versions and tells you; download them only from the releases page and [check the hash](install.md#check-the-download-first).
- Release builds have no developer tools and refuse to start with remote debugging switches, so nobody at your keyboard can open a console into your unlocked vaults that way.
- Site icons in the entry list are fetched from each entry's own website over https, without cookies. Nothing goes to a third-party icon service.
- Links in entries open in your browser, and only `http`, `https` and `mailto` links are opened.
