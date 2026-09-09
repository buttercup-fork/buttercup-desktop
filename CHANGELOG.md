# Changelog

All notable changes to this fork of Buttercup Desktop are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release history up to and including **2.28.1** predates this file and lives in the [git tags](https://github.com/codekunde/buttercup-desktop/tags) and the original project's GitHub Releases.

## [Unreleased]

### Added

- Ctrl/Cmd+Tab and Ctrl/Cmd+Shift+Tab now cycle forward and backward through the vault tabs (Ctrl/Cmd+PageDown / +PageUp do the same).
- Copying a field now shows a brief confirmation toast. The message names what was copied: "Username copied!" / "Password copied!" from the entries-list keyboard shortcuts (Ctrl/Cmd+B, Ctrl/Cmd+C), and "OTP copied!" / "Password copied!" / "Username copied!" / "{field name} copied!" from a field's clipboard button, falling back to "Copied!". The history-dialog copy button shows "Copied!". The toast is sized to its text rather than Blueprint's default 300px minimum. The entry-detail and history copy buttons also now use the native clipboard API instead of the hidden-`textarea` `execCommand` hack, matching the entries-list shortcuts.

### Changed

- The "Clear clipboard after" and "Lock vaults after" settings (Preferences → Security) are now dropdowns with sensible presets (Off, 30 seconds, 1 minute, … up to 1 day) instead of continuous sliders. The lock-vaults slider spanned 0-24h with a tick label every hour, so the labels were an unreadable smear and small values were almost impossible to select with the mouse. A previously-saved value that isn't a preset stays selectable.
- macOS builds are now produced for both Intel (`x64`) and Apple Silicon (`arm64`), as separate `.dmg` / `.zip` artifacts named with the architecture (upstream [#1276](https://github.com/buttercup/buttercup-desktop/issues/1276)). The previous build was Intel-only, so on Apple Silicon it ran under Rosetta 2 - which is slow (the likely cause of the "everything lags ~1 second" reports) and which recent macOS flags with a "will not open in a future release of macOS" warning. Apple Silicon users should now install the `arm64` build.

### Fixed

- Auto-lock (Preferences → "Lock vaults after…") works again (upstream [#1033](https://github.com/buttercup/buttercup-desktop/issues/1033)). It was gated on an internal flag that defaulted to off and was only flipped on as a side effect of the "pause auto-update while editing" logic, and the timer was only ever (re)started by mouse movement in the window - so in most cases it never armed. Auto-lock is now driven directly by the preference: the timer is armed when a vault is unlocked, when the preference changes, and on any mouse **or keyboard** activity, and it's suspended only while you're editing an entry (so you can't be locked out mid-edit; leaving the editor always clears that suspension).
- You can now connect vaults from more than one Dropbox account (upstream [#1314](https://github.com/buttercup/buttercup-desktop/issues/1314)). The Dropbox sign-in window ran in the app's shared session, so after the first account was connected it silently reused that login with no way to switch. It now uses a fresh, throwaway session each time, so Dropbox always asks which account to use; the session is wiped when the window closes.
- Signing in to Dropbox with a Google account is more likely to work (upstream [#888](https://github.com/buttercup/buttercup-desktop/issues/888)). The sign-in window now presents a normal desktop Chrome user-agent instead of the default one containing "Electron", which Google rejects with "this browser or app may not be secure". This is a mitigation - Google may still block the embedded window; the robust fix is an external-browser sign-in flow (tracked separately).
- Unlocking a vault from the tray icon or the Vaults menu no longer shows a blank password dialog (upstream [#1280](https://github.com/buttercup/buttercup-desktop/issues/1280)). The prompt worked out which vault it was for from `VAULTS_STATE.currentVault`, which is only set by clicking a vault tab - so a menu/tray unlock left it unset and the dialog rendered with no password field. The unlock flow now records the target vault explicitly, and navigating to a vault via the menu/tray also keeps the rest of the app (facade refresh, attachments) pointed at it.
- After unlocking a vault, the first group is now selected automatically, so the entries pane is populated and the "New Entry" button works straight away instead of staying disabled until a group is clicked (upstream [#1045](https://github.com/buttercup/buttercup-desktop/issues/1045)). The underlying crash ("No group selected") was already guarded; this removes the dead-end state that led to it.
- The entries list filter now works again (upstream [#1111](https://github.com/buttercup/buttercup-desktop/issues/1111)). Two bugs stacked on top of each other: (1) choosing "Filter" from the sort menu showed nothing - a JSX condition with mixed `&&`/`||` and missing parentheses evaluated to the bare value `true` (which React renders as nothing), so the header went blank with no input box; (2) once the box did appear, the first keystroke crashed the whole window with "Searching interface not prepared", because the filter created a `VaultFacadeEntrySearch` and called `searchByTerm` without ever awaiting its async `prepare()`. The filter is now a plain synchronous, case-insensitive, all-tokens-must-match substring match over each entry's visible field values, which also can't be tripped up by a null field value from a rough import.
- Moving an entry to the trash while editing it now closes the editor instead of leaving it open on a stale copy (with the save / cancel / trash bar still showing). The "stop editing when the edited entry is trashed" check was reading a stale snapshot of the editing state because of an incomplete `useCallback` dependency list.
- A vault save that stalls indefinitely (e.g. a WebDAV or cloud server that accepts the connection but never responds) no longer leaves every button disabled until the app is restarted (upstream [#1077](https://github.com/buttercup/buttercup-desktop/issues/1077)). The save now times out after 90 seconds, clears the saving state and shows a "Vault failed to save: timed out" error instead of hanging forever. If the underlying request does eventually complete after the timeout, that outcome is logged rather than surfaced.
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
- An empty or truncated config/vault-list file no longer bricks the app on boot (upstream [#1107](https://github.com/buttercup/buttercup-desktop/issues/1107)). `FileStorage` was re-throwing the `JSON.parse` error, so a single corrupt file left the app unable to start with no way to recover short of editing files by hand. It now moves the bad file aside (renamed with a `.corrupt-<timestamp>` suffix) and starts from an empty store. Writes are also now atomic (written to a temp file and renamed into place), so a crash mid-write can no longer produce the truncated file in the first place.
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
