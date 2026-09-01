# Buttercup Desktop
> Buttercup for Desktop - Mac, Linux and Windows

[![Buttercup](https://cdn.rawgit.com/buttercup-pw/buttercup-assets/6582a033/badge/buttercup-slim.svg)](https://buttercup.pw) ![Latest version](https://img.shields.io/github/tag/buttercup/buttercup-desktop.svg?label=latest) [![Chat securely on Keybase](https://img.shields.io/badge/keybase-bcup-blueviolet)](https://keybase.io/team/bcup)

<img width="1406" alt="Buttercup Desktop screenshot" src="https://github.com/buttercup/buttercup-desktop/assets/3869469/1320b163-3e5c-4423-a4fd-8de7ffad2a0e">
²

---

⚠️ **Project Closure** ⚠️

The Buttercup project has come to an end, and these repositories are in transition to becoming public archives. No public-facing resources will be removed, wherever possible. Please do not create issues or PRs - they will unfortunately be ignored. Discussion can be found [here](https://github.com/buttercup/buttercup-desktop/discussions/1395), and explanation [here](https://gist.github.com/perry-mitchell/43ebfcec4d874b77a704be1d4f2262e6).

---

ℹ️ **About this fork**

This is a [**ByteWerk Labs**](https://github.com/bytewerk-labs) fork of the archived upstream project, maintained independently to rebuild, modernize and keep the app secure (dependency upgrades, Electron modernization, tooling). It is not affiliated with or endorsed by the original Buttercup maintainers. See [`CHANGELOG.md`](CHANGELOG.md) for what has changed.

It depends on the companion fork [`bytewerk-labs/buttercup-core`](https://github.com/bytewerk-labs/buttercup-core).

---

## About

Buttercup is a free, open-source and cross-platform **password manager**, built on NodeJS with Typescript. It uses strong industry-standard encryption to protect your passwords and credentials (among other data you store in Buttercup vaults) at rest, within vault files (`.bcup`). Vaults can be loaded from and saved to a number of sources, such as the **local filesystem**, **Dropbox**, **Google Drive** or any **WebDAV**-enabled service (like _ownCloud_ or _Nextcloud_ ¹).

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

The current stable version is **2**. We recommend upgrading if you're still on v1, as it is no longer being actively maintained. You can still browse the v1 source and documentation [here](https://github.com/buttercup/buttercup-desktop/tree/v1).

Buttercup is built on Node 22 LTS - no other platform is officially supported.

### Operating Systems

Buttercup Desktop is officially supported on:

 * Most linux distributions (x64), such as Ubuntu
 * MacOS (x64, Apple Silicon¹)
 * Windows 10 / 11 (x64)

 ¹ No builds yet

#### Arch Linux

Buttercup is also available for [Arch via the AUR](https://aur.archlinux.org/packages/buttercup-desktop/). This release channel is maintained by our community.

Some Arch users have reported the occasional segfault - if you experience this please try [this solution](https://github.com/buttercup/buttercup-desktop/issues/643#issuecomment-413852760) before creating an issue.

#### 32bit builds (x86)

Buttercup no longer provides 32bit builds, due to the complexity of supporting them in the build pipeline.

## Portability

Buttercup provides a portable **Windows** version. Look for the release with the name `Buttercup-win-x64-2.0.0-portable.exe` where `2.0.0` is the version and `x64` is the architecture.

Although not explicitly portable, both the Mac **zip** and Linux **AppImage** formats are more or less standalone. They still write to the standard config/log destinations, however.

To make the most of the portable version, some enviroment variables are required:

| Enviroment Variables   | Description |
|------------------------|-------------|
| `BUTTERCUP_HOME_DIR`   | If provided buttercup will use this path for saving __configrations__ , __user settings__ or even __temprorary files__ |
| `BUTTERCUP_CONFIG_DIR` | Stores __user settings__, not allways needed but can be used to change config location or will default to BUTTERCUP_HOME_DIR `Optional: Only activates if BUTTERCUP_HOME_DIR is provided` |
| `BUTTERCUP_TEMP_DIR`   | Same as BUTTERCUP_CONFIG_DIR but stores __temprory files__ `Optional: Only activates if BUTTERCUP_HOME_DIR is provided` |

### Sample `ButtercupLauncher.bat` for Windows portable executable

> This example stores user settings and cache on the portable folder, but stores temprory files on the host PC.

```bat
@ECHO OFF
if not exist "%~dp0Buttercup" mkdir "%~dp0Buttercup"
set "BUTTERCUP_HOME_DIR=%~dp0Buttercup"
set "BUTTERCUP_TEMP_DIR=%temp%"
start %~dp0Buttercup.exe %*
```

## Configuration

Configuration files are stored in OS-specific locations.

### Command-Line arguments

The following arguments can be provided to Buttercup, but are all optional.

| Argument              | Description                           |
|-----------------------|---------------------------------------|
| `--autostart`         | Flag passed to Buttercup when launched automatically by the OS. |
| `--hidden`            | Disables the automatic opening of the main window upon launch. |
| `--no-update`         | Disables automatic update checking. **Not recommended**: Use at your own risk. |

### App config

Application configuration.

 * Linux: `$XDG_CONFIG_HOME/Buttercup/desktop.config.json`
 * Mac: `~/Library/Preferences/Buttercup/desktop.config.json`
 * Windows: `$APPDATA/Buttercup/Config/desktop.config.json`

### Vault storage

Storage of connected vaults (not actual vault contents).

 * Linux: `$XDG_DATA_HOME/Buttercup/vaults.json`
 * Mac: `~/Library/Application\ Support/Buttercup/vaults.json`
 * Windows: `$LOCALAPPDATA/Buttercup/Data/vaults.json`

### Offline vault cache

Stored copies of vaults for offline use.

 * Linux: `$(node -e "console.log(os.tmpdir())")/$(whoami)/Buttercup/vaults-offline.cache.json`
 * Mac: `$(node -e "console.log(os.tmpdir())")/Buttercup/vaults-offline.cache.json`
 * Windows: `$(node -e "console.log(os.tmpdir())")/Buttercup/vaults-offline.cache.json`

### Logs

Logs are written for all app sessions.

 * Linux: `~/.local/state/Buttercup-nodejs` or `$XDG_STATE_HOME/Buttercup-nodejs`
 * Mac: `~/Library/Logs/Buttercup-nodejs`
 * Windows: `%LOCALAPPDATA%\Buttercup-nodejs\Log`

_Note that logs for portable Windows applications will be written to the same directory that the executable resides in._

## Published Applications

You can view the current releases on the [Buttercup Desktop releases page](https://github.com/buttercup/buttercup-desktop/releases). Under each release are some assets - the various binaries and installers for each platform Buttercup supports. When installing or downloading, make sure to pick the right operating system and architecture for your machine.

_Note that at this time, Buttercup only supports x64 (64 bit) machines._

### Linux

We provide an **AppImage** build for Linux, because it is the most desirable format for us to release. AppImages support auto-updating, a crucial feature (we feel) for a security application. The other build types do not.

**Important:** Buttercup uses Electron to build its desktop application, which relies on [**AppImageLauncher**](https://github.com/TheAssassin/AppImageLauncher#readme) for correct integration of AppImages into the host OS. Features like **Google Drive** authentication and correct `.desktop` icon use is only performed when integrating via AppImageLauncher. We highly recommend that you install it.

We won't be supporting formats like Snapcraft, deb or rpm images as they do not align with our requirements. Issues requesting these formats will be closed immediately. Discussion on topics like this should be started on other social channels.

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

`npm audit` is expected to report **0 vulnerabilities**. Transitive packages that upstream never patched are pinned in the `overrides` block of `package.json` — check there first if an `npm update` reintroduces a finding.

## Building & Releasing

There is **no automated release pipeline** in this repo — the only GitHub Actions workflow (`.github/workflows/test.yml`) just runs `npm test` on every push. Producing installers and cutting a release is a **manual** process.

### Local, unsigned builds

To produce installers for the platform you are on:

```bash
npm run package:win     # dist/*.exe, *.7z, portable  (run on Windows)
npm run package:mac     # dist/*.dmg, *.zip           (run on macOS)
npm run package:linux   # dist/*.AppImage             (run on Linux)
```

Each platform's installers must be built on that platform (macOS builds in particular cannot be produced or signed elsewhere). Output lands in `dist/`. These builds are **not code-signed**, so Windows SmartScreen and macOS Gatekeeper will warn on first run.

### Publishing a release

The simplest path is the **`Build` GitHub Actions workflow**: pushing a `v*` tag builds unsigned installers for all three platforms and drafts a GitHub release with them attached (review the draft and publish it by hand). `build.publish` in `package.json` targets `bytewerk-labs/buttercup-desktop`.

For **signed** releases there is `npm run publish` (see `resources/scripts/publish.js`): it builds all three platforms, code-signs them (Windows via a YubiKey — `WIN_YUBIKEY_PIN`; macOS via Apple notarization — `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`), and uploads the artifacts plus the `latest*.yml` auto-update metadata to a GitHub release via `electron-builder` (`GH_TOKEN` required). It only completes on macOS and needs all of those secrets set.

electron-builder creates the GitHub release as a **draft**; review it and publish it by hand. Version comes from `package.json` (`npm run set-version` writes it into `source/main/library/build.ts`); tag releases `v<version>` to match the existing history.

> If you want CI to build and attach installers automatically on `git tag`, a matrix workflow across `windows-latest` / `macos-latest` / `ubuntu-latest` running `electron-builder --publish always` is the usual approach. It is not set up yet.

### Contributing

There are a number of ways you can contribute to Buttercup!

#### Features & Bug fixes

We welcome pull-requests and issues that serve to better Buttercup as a platform. Please remain respecful (this is free & open source after all) with your ideas and observations, and always consider opening an issue before starting on a substantial pull request.

#### Translations

Buttercup relies on the community for translating its interfaces into languages besides English. We use British English (en_GB) as the base language, and translate into all others that our contributors are kind enough to provide.

To add support for a language, make sure to add the translations for our [**vault UI**](https://github.com/buttercup/ui#translations--i18n) first. After that, you can follow these instructions to add another language to the desktop application:

 * Copy the `source/shared/i18n/translations/en.json` file to the language code you're providing (eg. `fi.json` for Finnish).
 * Edit the `source/shared/i18n/translations/index.ts` file and:
   * Import the new JSON file: `import fi from "./fi.json";`.
   * Export the imported constant inside the default export already in that file.

## Notes and Caveats

 * ¹ External services like Nextcloud and ownCloud must be configured correctly to support access via the web (using WebDAV). CORS must permit access from any source.
 * ² Buttercup (including MadDev Oy) is not affiliated with any of the companies represented in screenshots or preview images.
