# Buttercup Desktop
> Buttercup for Desktop - Mac, Linux and Windows

[![Buttercup - Codekunde fork](resources/badge/buttercup-codekunde.svg)](https://github.com/codekunde/buttercup-desktop) [![Latest release](https://img.shields.io/github/v/release/codekunde/buttercup-desktop?label=latest)](https://github.com/codekunde/buttercup-desktop/releases/latest)

<img width="1406" alt="Buttercup Desktop screenshot" src="https://github.com/buttercup/buttercup-desktop/assets/3869469/1320b163-3e5c-4423-a4fd-8de7ffad2a0e">

---

ℹ️ **About this fork**

The original [Buttercup password manager](https://github.com/buttercup/buttercup-desktop) was closed by its maintainers and its repositories archived. This is an independent fork, maintained by **Codekunde** to keep the app working and secure (bug fixes, dependency upgrades, Electron modernization, tooling). See [`CHANGELOG.md`](CHANGELOG.md) for what has changed. In-app update checks read this repository's releases.

This fork is not affiliated with, endorsed by, or supported by the original Buttercup maintainers. It has not yet undergone an independent security audit (this line will be removed once/if one happens).

It depends on the companion fork [`codekunde/buttercup-core`](https://github.com/codekunde/buttercup-core).

---

## About

Buttercup is a free, open-source and cross-platform **password manager**, built on NodeJS with Typescript. It uses strong industry-standard encryption to protect your passwords and credentials (among other data you store in Buttercup vaults) at rest, within vault files (`.bcup`). Vaults can be loaded from and saved to a number of sources, such as the **local filesystem**, **Dropbox**, **Google Drive** or any **WebDAV**-enabled service (like _ownCloud_ or _Nextcloud_ ¹).

> **Known issue:** signing in to **Google Drive** currently does not complete. It relied on a redirect service run by the original project (`buttercup.pw`), which is offline. A replacement sign-in flow is planned. Local files, Dropbox and WebDAV are unaffected.

### Why you need a password manager

Password management is a crucial tool when you have _any_ online presence. It's vital that all of your accounts online use strong and unique passwords so that they're much more difficult to break in to. Even if one of your accounts are breached, having unique passwords means that the likelihood of the attacker gaining further access to your accounts portfolio is greatly reduced.

Without a password manager, such as Buttercup, it would be very tedious to manage different passwords for each service. If you remember your passwords it's a good sign that they're not strong enough. Ideally you should memorise a primary password for your vault, and not know any of the account-specific passwords off the top of your head.

### Precautions

Buttercup securely encrypts your data in protected files, but this security is only as strong as the weakest component - and this is very often the primary password used to lock and unlock your vault. Follow these basic guidelines to ensure that your vault is safe even if exposed:

 * Choose a **unique** password that is not used elsewhere
 * Use a highly-varied set of different characters - such as alpha-numeric, symbols and spaces
 * Use a long password - the longer the better
 * Don't include words or names in the password
 * Never share your password with anyone

_It is very important to note that no one associated with Buttercup will ever request your personal vault or its primary password. Do not share it or any of its related details with anyone. Developers or contributors working with Buttercup may request **example** vaults created via your system to try and reproduce issues, but please ensure to never use your real password or store actual credentails within such vaults._

### Versions

The current stable version is **2**. If you're still on v1, upgrade: it is no longer maintained. You can still browse the v1 source and documentation [here](https://github.com/buttercup/buttercup-desktop/tree/v1).

The app is built on [Electron](https://www.electronjs.org/) (see `package.json` for the current version) and is built in CI with Node 22 LTS.

### Operating Systems

Builds are provided for:

 * Linux: x64 and arm64, as an AppImage (runs on most distributions, such as Ubuntu) and a `.deb` package (Debian/Ubuntu)
 * macOS: Intel (x64) and Apple Silicon (arm64)¹
 * Windows 10 / 11 (x64)

 ¹ Apple Silicon builds first shipped in 2.31.0 and have not yet been tested on real Apple Silicon hardware.

All builds are **unsigned** - see [Published Applications](#published-applications).

#### 32bit builds (x86)

This fork does not provide 32bit builds.

## Portability

Buttercup provides a portable **Windows** version. Look for the release asset named like `Buttercup-win-x64-2.31.0-portable.exe`, where `2.31.0` is the version and `x64` is the architecture.

Although not explicitly portable, both the Mac **zip** and Linux **AppImage** formats are more or less standalone. They still write to the standard config/log destinations, however.

**On its own, the Windows portable build is not fully portable:** it still keeps its configuration and vault list in the standard OS locations (see [Configuration](#configuration)); only the log file is written next to the executable. To keep everything alongside the executable, set some environment variables:

| Environment Variable   | Description |
|------------------------|-------------|
| `BUTTERCUP_HOME_DIR`   | If provided, Buttercup keeps its data, configuration, cache, log and temporary files under this path (in `data`, `config`, `cache`, `log` and `temp` sub-folders). |
| `BUTTERCUP_CONFIG_DIR` | Optional. Stores user settings (in a `config` sub-folder) here instead of under `BUTTERCUP_HOME_DIR`. Only takes effect if `BUTTERCUP_HOME_DIR` is provided. |
| `BUTTERCUP_TEMP_DIR`   | Optional. Stores temporary files (in a `temp` sub-folder) here instead of under `BUTTERCUP_HOME_DIR`. Only takes effect if `BUTTERCUP_HOME_DIR` is provided. |

### Sample `ButtercupLauncher.bat` for Windows portable executable

> This example stores user settings and cache in a folder next to the launcher, but stores temporary files on the host PC. Change the executable's file name to match the version you downloaded.

```bat
@ECHO OFF
if not exist "%~dp0Buttercup" mkdir "%~dp0Buttercup"
set "BUTTERCUP_HOME_DIR=%~dp0Buttercup"
set "BUTTERCUP_TEMP_DIR=%temp%"
start "" "%~dp0Buttercup-win-x64-2.31.0-portable.exe" %*
```

## Configuration

Configuration files are stored in OS-specific locations (unless `BUTTERCUP_HOME_DIR` is set - see [Portability](#portability)). Note the `Buttercup-nodejs` folder name.

### Command-Line arguments

The following arguments can be provided to Buttercup, but are all optional.

| Argument              | Description                           |
|-----------------------|---------------------------------------|
| `--autostart`         | Flag passed to Buttercup when launched automatically by the OS. |
| `--hidden`            | Disables the automatic opening of the main window upon launch. |
| `--no-update`         | Disables automatic update checking. **Not recommended**: Use at your own risk. |

### App config

Application configuration.

 * Linux: `$XDG_CONFIG_HOME/Buttercup-nodejs/desktop.config.json` (`~/.config` if `XDG_CONFIG_HOME` is unset)
 * Mac: `~/Library/Preferences/Buttercup-nodejs/desktop.config.json`
 * Windows: `%APPDATA%\Buttercup-nodejs\Config\desktop.config.json`

### Vault storage

Storage of connected vaults (not actual vault contents).

 * Linux: `$XDG_DATA_HOME/Buttercup-nodejs/vaults.json` (`~/.local/share` if `XDG_DATA_HOME` is unset)
 * Mac: `~/Library/Application Support/Buttercup-nodejs/vaults.json`
 * Windows: `%LOCALAPPDATA%\Buttercup-nodejs\Data\vaults.json`

### Offline vault cache

Stored copies of vaults for offline use, in your OS's temporary directory (`os.tmpdir()`).

 * Linux: `<tmpdir>/<username>/Buttercup-nodejs/vaults-offline.cache.json`
 * Mac: `<tmpdir>/Buttercup-nodejs/vaults-offline.cache.json`
 * Windows: `<tmpdir>\Buttercup-nodejs\vaults-offline.cache.json`

### Logs

Logs are written for all app sessions, to `buttercup-desktop.log` in:

 * Linux: `~/.local/state/Buttercup-nodejs` or `$XDG_STATE_HOME/Buttercup-nodejs`
 * Mac: `~/Library/Logs/Buttercup-nodejs`
 * Windows: `%LOCALAPPDATA%\Buttercup-nodejs\Log`

_Note that logs for portable Windows applications will be written to the same directory that the executable resides in._

## Published Applications

You can view the current releases on the [releases page](https://github.com/codekunde/buttercup-desktop/releases). Under each release are the binaries and installers for each supported platform. Make sure to pick the right operating system and architecture for your machine:

| Platform | Assets |
|----------|--------|
| Windows (x64) | `Buttercup-win-x64-<version>-installer.exe` (installer), `Buttercup-win-x64-<version>-portable.exe` (portable), `Buttercup-win-x64-<version>.7z` (archive) |
| macOS, Intel | `Buttercup-mac-x64-<version>.dmg` / `.zip` |
| macOS, Apple Silicon | `Buttercup-mac-arm64-<version>.dmg` / `.zip` |
| Linux, x64 | `Buttercup-linux-x86_64.AppImage`, `Buttercup-linux-amd64.deb` (Debian/Ubuntu) |
| Linux, arm64 | `Buttercup-linux-arm64.AppImage`, `Buttercup-linux-arm64.deb` (Debian/Ubuntu) |

**These builds are not code-signed**, so your OS will warn you the first time you run them:

 * **Windows** SmartScreen: choose _More info_, then _Run anyway_.
 * **macOS** Gatekeeper: right-click the app and choose _Open_ (or run `xattr -cr /Applications/Buttercup.app` once).

### Linux

We provide an **AppImage** build for Linux, because it supports auto-updating, a crucial feature (we feel) for a security application. There is also a **`.deb`** package for Debian, Ubuntu and derivatives, installed with `sudo apt install ./Buttercup-linux-amd64.deb` (or `-arm64.deb`). The `.deb` does **not** update itself: to update, download the new release's `.deb` and install it over the old one. Other package formats (rpm, Snap) are not provided at this time.

The `.deb` installs its own menu entry and URL-scheme handler. The AppImage registers its own `.desktop` entry and URL-scheme handler when run, so no extra tooling is required. Installing [**AppImageLauncher**](https://github.com/TheAssassin/AppImageLauncher#readme) is still a good way to integrate AppImages into your desktop (menu entries, icons, updates) if you'd like that.

## Development

You need **Node 20 or greater** with **npm 9 or greater**. No IDE is required — any editor works (VS Code is convenient; see [`e2e/README.md`](e2e/README.md) for its optional Playwright extension).

Once cloned, install dependencies with `npm install`. This also builds the `buttercup-core` fork (pulled straight from git), so the first install takes a little longer.

Then, in two terminals:

```bash
npm run start:build     # webpack, development mode, watches for changes
npm run start:main      # launches Electron once build/ exists (Ctrl+R reloads the UI)
```

### Running alongside an installed Buttercup

If you use Buttercup on the same machine, run the dev build isolated so it never reads or writes your real config, vault list or logs:

```bash
npm run start:isolated  # uses a throwaway data dir under your temp folder
```

### Tests

```bash
npm run test:specs      # Jest unit tests (source/**/*.test.ts)
npm run test:e2e         # Playwright end-to-end UI tests — builds first, then runs
npm run test:e2e:ui      # ...same, in Playwright's interactive runner
npm test                 # build + unit specs + prettier check (what CI runs)
```

The e2e tests launch the real app in an isolated data directory. See [`e2e/README.md`](e2e/README.md).

### Dependency security

`npm audit` currently reports **2 moderate** findings, both the same issue: `csv-parse` pulled in by `@buttercup/importer` (used for importing from other password managers and CSV files). The only automatic fix is a breaking downgrade of that package, so it is not applied. Other transitive packages that upstream never patched are pinned in the `overrides` block of `package.json` — check there first if an `npm update` reintroduces a finding.

## Building & Releasing

Two GitHub Actions workflows live in `.github/workflows/`:

 * **`test.yml`** runs on every push and on pull requests to `master`: a build plus the unit tests and prettier check on Ubuntu, macOS and Windows, and an informational Playwright end-to-end run.
 * **`build.yml`** runs on pushes to `master`, on `v*` tags, and on demand: it builds **unsigned** installers on Windows, macOS and Linux. On a `v*` tag it also **drafts a GitHub release** with all of the artifacts (including the `latest*.yml` auto-update metadata) attached.

### Local, unsigned builds

To produce installers for the platform you are on:

```bash
npm run package:win     # dist/*.exe, *.7z, portable  (run on Windows)
npm run package:mac     # dist/*.dmg, *.zip           (run on macOS)
npm run package:linux   # dist/*.AppImage, *.deb      (run on Linux)
```

Each platform's installers must be built on that platform (macOS builds in particular cannot be produced or signed elsewhere). Run `npm run build` first if `build/` is stale. Output lands in `dist/`. These builds are **not code-signed**, so Windows SmartScreen and macOS Gatekeeper will warn on first run.

### Publishing a release

 1. Bump `version` in `package.json` (and the two version fields in `package-lock.json`), run `npm run set-version` (it writes the version into `source/main/library/build.ts`), and add the release to `CHANGELOG.md`.
 2. Merge that to `master`, then tag it `v<version>` and push the tag (`git tag v2.31.0 && git push origin v2.31.0`).
 3. The `Build` workflow builds everything and drafts the release. Review the draft and publish it by hand.

`build.publish` in `package.json` targets `codekunde/buttercup-desktop`, which is also where the in-app updater looks for new versions.

For **signed** releases there is `npm run publish` (see `resources/scripts/publish.js`): it builds all three platforms, code-signs them (Windows via a YubiKey — `WIN_YUBIKEY_PIN`; macOS via Apple notarization — `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`), and uploads the artifacts plus the `latest*.yml` auto-update metadata to a GitHub release via `electron-builder` (`GH_TOKEN` required). It only completes on macOS and needs all of those secrets set. The secrets are not currently configured, so releases are unsigned.

### Contributing

There are a number of ways you can contribute to Buttercup!

#### Features & Bug fixes

Pull requests and issues that make Buttercup better are welcome on this repository (issues and PRs on the original, archived project will not be seen). Please be respectful with your ideas and observations, and consider opening an issue before starting on a substantial pull request.

#### Translations

Buttercup relies on the community for translating its interfaces into languages besides English. English (`en.json`) is the base language, and all others are contributed translations.

To add support for a language, follow these instructions to add another language to the desktop application:

 * Copy the `source/shared/i18n/translations/en.json` file to the language code you're providing (eg. `fi.json` for Finnish).
 * Edit the `source/shared/i18n/translations/index.ts` file and:
   * Import the new JSON file: `import fi from "./fi.json";`.
   * Export the imported constant inside the default export already in that file.

## Notes and Caveats

 * ¹ External services like Nextcloud and ownCloud must be configured correctly to support access via the web (using WebDAV). CORS must permit access from any source.
 * ² Buttercup (including MadDev Oy) is not affiliated with any of the companies represented in screenshots or preview images.
