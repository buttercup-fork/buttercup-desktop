# Install and verify a download

Downloads are on the [releases page](https://github.com/buttercup-fork/buttercup-desktop/releases). Pick the file for your system:

| System | File | Notes |
|---|---|---|
| Windows 10 / 11 (x64) | `Buttercup-win-x64-<version>-installer.exe` | Installs for your user, adds a Start menu entry. |
| | `Buttercup-win-x64-<version>-portable.exe` | Runs without installing; keeps its data in a `Buttercup-data` folder next to the `.exe`. |
| Linux x64 | `Buttercup-linux-amd64.deb` | Debian, Ubuntu and derivatives. Recommended on Ubuntu 24.04 and later (see below). |
| | `Buttercup-linux-x86_64.AppImage` | Runs on most distributions. |

## Check the download first

A password manager is worth thirty seconds of checking. Each release has a `SHA256SUMS.txt` with the SHA-256 hash of every file. Download it next to your file, then:

**Windows (PowerShell):**

```powershell
Get-FileHash .\Buttercup-win-x64-<version>-installer.exe -Algorithm SHA256
```

Compare the hash with the line for that file in `SHA256SUMS.txt`. They must match exactly.

**Linux:**

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

It prints `OK` for the file you downloaded.

Only download from the releases page of this repository. If anyone sends you a Buttercup installer by mail, chat or another site, don't run it.

## The first start: "unknown publisher" warnings

The builds are **not code-signed** yet, so your system warns you the first time:

- **Windows SmartScreen** says it protected your PC. If the hash matched, choose **More info**, then **Run anyway**.
- **Linux** doesn't warn, but an AppImage must be made executable first: `chmod +x Buttercup-linux-x86_64.AppImage`, or tick "Allow executing file as program" in its file properties.

## Linux

**`.deb`:** install with

```bash
sudo apt install ./Buttercup-linux-amd64.deb
```

It adds a menu entry. It does **not** update itself: to update, download the new release's `.deb` and install it the same way.

**AppImage:** start it directly. It registers its own menu entry when run.

**Ubuntu 24.04 and later:** these versions block something Chromium's sandbox needs. The `.deb` installs a small AppArmor profile that allows it, so Buttercup runs inside the sandbox. The AppImage can't, so on those systems it starts without the sandbox (and notes that in its log). Use the `.deb` there.

**Lock on screen lock** needs the `dbus-monitor` program, from the `dbus-bin` package on Debian and Ubuntu (most desktops have it already). See [Security settings](security-settings.md#lock-vaults-when-the-computer-locks).

## Updates

Buttercup checks for new versions and shows what's new. Its **Download** button opens the releases page: download the new version, check its hash, and install it over the old one. The app doesn't download or install updates itself while releases aren't signed, because it couldn't check who built an update.

## Uninstall

- **Windows:** Settings → Apps → Buttercup → Uninstall. The portable app: delete the `.exe` and its `Buttercup-data` folder.
- **Linux `.deb`:** `sudo apt remove buttercup`. AppImage: delete the file.

Uninstalling doesn't delete your vault files, wherever you keep them. The app's settings and vault list stay in the folders listed in the [README](../README.md#configuration).
