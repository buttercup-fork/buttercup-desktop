# Changelog

All notable changes to this fork of Buttercup Desktop are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release history up to and including **2.28.1** predates this file and lives in the [git tags](https://github.com/codekunde/buttercup-desktop/tags) and the original project's GitHub Releases.

## [Unreleased]

### Fixed

- Linux: the custom URL scheme (`codekunde-buttercup://`) is now registered at runtime when running from a bare AppImage, so Google Drive and other protocol auth callbacks are delivered back to the app without requiring AppImageLauncher (upstream [#987](https://github.com/buttercup/buttercup-desktop/issues/987)). A `~/.local/share/applications/codekunde-buttercup.desktop` entry is written/refreshed on start and registered via `xdg-mime`.
- A protocol URL passed on the command line at cold start (Linux/Windows) is now handled once the window is ready, instead of only being handled when an instance is already running.
- The entries-list copy shortcuts (Ctrl/Cmd+C for password, Ctrl/Cmd+B for username) now always act on the currently selected entry rather than the previously selected one (upstream [#1384](https://github.com/buttercup/buttercup-desktop/issues/1384)). The handlers now read live selection state through a ref, working around `react-hotkeys` caching stale handler closures, and look the field up by property (`username` / `password`) instead of by its display title.
- The entries-list copy shortcuts now write to the clipboard via the native clipboard API instead of a hidden-`textarea` `execCommand` hack. The hack stole and then dropped keyboard focus, which left the list unfocused so the next shortcut press was silently ignored (and beeped). Copying via shortcut now also arms the auto-clear-clipboard timer, matching the field copy buttons.
- Keyboard navigation of the entries list is now consistent: arrow keys move the highlight and keep DOM focus on the highlighted row (previously focus lagged one row behind), and Enter acts on the highlighted entry instead of clicking whatever element happened to hold focus - which had been snapping the selection back to a previously focused entry.
- Enter now activates the primary action from the keyboard where it previously did nothing (upstream [#1349](https://github.com/buttercup/buttercup-desktop/issues/1349)): the "unlock" button on a locked vault (Enter or Space), the password field when adding or creating a vault, and the WebDAV URL / password fields in the add-vault dialog.
- Escape now closes the add-vault dialog from every page. Previously the built-in handler only fired when focus was inside an input, so Escape did nothing on the vault-type selection page.
- Deleting a custom field now sticks, and renaming a custom field no longer leaves a duplicate behind (upstream [#1342](https://github.com/buttercup/buttercup-desktop/issues/1342)). The fix is in `buttercup-core`: the Format B vault merge (run on every save) was discarding each property's deletion tombstone, so the next save resurrected any field that had been removed. Requires `codekunde/buttercup-core` at the commit carrying this change.
- The create/rename group dialog now focuses (and selects) the group-name field when it opens; the old focus effect keyed off a ref value and never re-ran once the dialog existed.
- Adding a new entry now focuses the Title field so you can type immediately, instead of leaving the form with nothing focused.
- The app now also registers and handles the legacy `buttercup://` URL scheme for inbound auth callbacks (all platforms), not just `codekunde-buttercup://`. Note: Google Drive sign-in still does not complete end to end, because the OAuth redirect it depends on (`buttercup.pw`) is an upstream service that is currently offline; a self-contained loopback auth flow is needed to fully restore it.
- Enabling browser access no longer crashes with an uncaught `EADDRINUSE` exception when the port is already taken (e.g. a second Buttercup instance). The failure is now reported as a notification and the preference is rolled back instead of showing as enabled while nothing is listening.
- The vault's three-pane split (groups / entries / details) now remembers its column widths across restarts instead of resetting to the default every launch (upstream [#1367](https://github.com/buttercup/buttercup-desktop/issues/1367)). Sizes are stored per machine and applied proportionally, so the ratio holds at any window size.

## [2.30.1] - 2026-09-06

### Changed

- Renamed the GitHub organisation from `bytewerk-labs` to `codekunde` and updated all repository, issue, homepage and electron-builder `publish` metadata (and the `buttercup-core` git dependency) accordingly.
- **Breaking:** renamed the custom URL protocol scheme from `bytewerklabs-buttercup://` to `codekunde-buttercup://` (`build.protocols` / `linux.mimeTypes` in `package.json`, `BUTTERCUP_PROTOCOL` in `source/main/symbols.ts`), following the organisation rename. Reinstall the app to re-register the handler; anything that links to the app via the old scheme needs updating.

## [2.30.0] - 2026-09-05

### Changed

- **Breaking:** renamed the custom URL protocol scheme from `buttercup://` to `bytewerklabs-buttercup://` (`build.protocols` / `linux.mimeTypes` in `package.json`, `BUTTERCUP_PROTOCOL` in `source/main/symbols.ts`), to avoid colliding with the original upstream Buttercup app's protocol handler if both are installed on the same machine. Anything that links to the app via the old scheme needs updating.
- Fixed the `buttercup-core` git dependency's org casing to `github:codekunde/buttercup-core#master`.
- Expanded the README fork disclaimer with a note that this fork has not yet undergone an independent security audit.

### Fixed

- Resolved 3 moderate `npm audit` findings via `overrides`: `qs` (flat) and a nested `iocane` override for `@buttercup/secure-file-host`.
- Pinned `electron` back to `44.1.0` after a dependency reinstall let its `^44.1.0` range float to `44.2.0` unintentionally, and reformatted `source/main/ipc.ts` to match the `prettier` version that same reinstall pulled in.

## [2.29.0] - 2026-09-01

First release of the Codekunde fork. A modernization pass over the archived upstream 2.28.1: dependency security, Electron 44, and testing/CI tooling. No user-facing feature or behaviour changes.

### Security

- Cleared all 36 `npm audit` findings (4 critical, 16 high, 16 moderate) — audit now reports 0 vulnerabilities.
  - Removed `spectron` (end-of-life, unused), which pulled in vulnerable `webdriverio`, `puppeteer-core`, `got`, `extract-zip`, `@electron/get` and others.
  - Bumped `electron` 22 → 44, `electron-builder` 24 → 26 and `copy-webpack-plugin` 7 → 12.
  - Added `overrides` to force patched transitive dependencies: `xml2js`, `yaml`, `minimatch`, `pbkdf2`, `decode-uri-component`, `serialize-javascript`, `tar`, `uuid`.

### Changed

- Upgraded to Electron 44, and `@electron/remote` 2.0 → 2.1 (2.0.x crashed the
  renderer on Electron 44 with `isDesktopCapturerEnabled is not a function`,
  leaving a blank window). Adjusted `source/main` code for API/type changes:
  - `window-all-closed` handler no longer receives an `event` argument.
  - `LoginItemSettings.wasOpenedAsHidden` / `Settings.openAsHidden` are cast (no longer in Electron's type definitions; still present at runtime on macOS).
  - `clipboard.readText()` is now awaited in the auto-clear-clipboard timer.
- Replaced the Pug renderer template (`resources/renderer.pug`) with plain HTML (`resources/renderer.html`) and removed `pug` / `pug-loader`.
- The `buttercup` dependency now tracks the `codekunde/buttercup-core` fork.
- Pointed `repository`, `bugs`, `homepage` and the electron-builder `publish`
  target at `codekunde/buttercup-desktop`.
- Migrated the `build` config for electron-builder 26: `linux.desktop` entries moved under `desktop.entry`; `win.sign` / `win.publisherName` moved under `win.signtoolOptions`; `mac.notarize` is now a boolean (set to `false` — set it to `true` with `APPLE_TEAM_ID=9D8F4J769D` and the other Apple env vars to notarize).
- Dropped the Linux `armv7l` (32-bit ARM) AppImage target — Electron 44 no longer ships that architecture. Linux builds are now x64 + arm64.
- Removed the `afterAllArtifactBuild` hook (`resources/scripts/afterAllArtifactBuild.js`). It was a workaround for old electron-builder macOS zip/blockmap handling and broke under v26; v26 generates the mac `zip`, blockmap and `latest-mac.yml` natively.
- `resources/scripts/windowsSign.js` now skips signing (unsigned build) when `WIN_YUBIKEY_PIN` is unset instead of throwing, so `npm run package:win` works without the signing key.

### Added

- End-to-end UI tests with Playwright (`e2e/`, `playwright.config.ts`). Run with `npm run test:e2e` (or `npm run test:e2e:ui` for the interactive runner). See [`e2e/README.md`](e2e/README.md).
- `npm run start:isolated` — runs a development build against a throwaway data directory so it can coexist with a personally-installed Buttercup without touching its config, vault list or logs.
- CI: `.github/workflows/build.yml` builds unsigned installers for Windows, macOS and Linux on every push to `master` (and on `v*` tags, where it also drafts a GitHub release with the artifacts attached); can also be run manually. Rewrote `test.yml` (was pinned to deprecated actions and only ran on Ubuntu) into a 3-OS build/unit matrix plus a Playwright e2e job (the e2e job is informational — the Electron window doesn't reliably come up under a headless display; the suite passes on a real desktop).
- CI actions bumped to Node 24 runtime (`actions/checkout@v5`, `actions/setup-node@v5`, `actions/{upload,download}-artifact@v7`); CI Node is 22. `engines` bumped to `node >=20`, `npm >=9`.
- This `CHANGELOG.md`.

[Unreleased]: https://github.com/codekunde/buttercup-desktop/compare/v2.30.1...HEAD
[2.30.1]: https://github.com/codekunde/buttercup-desktop/compare/v2.30.0...v2.30.1
[2.30.0]: https://github.com/codekunde/buttercup-desktop/compare/v2.29.0...v2.30.0
[2.29.0]: https://github.com/codekunde/buttercup-desktop/compare/v2.28.1...v2.29.0
