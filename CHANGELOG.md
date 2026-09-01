# Changelog

All notable changes to this fork of Buttercup Desktop are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release history up to and including **2.28.1** predates this file and lives in the [git tags](https://github.com/bytewerk-labs/buttercup-desktop/tags) and the original project's GitHub Releases.

## [Unreleased]

## [2.29.0] - 2026-09-01

First release of the ByteWerk Labs fork. A modernization pass over the archived upstream 2.28.1: dependency security, Electron 44, and testing/CI tooling. No user-facing feature or behaviour changes.

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
- The `buttercup` dependency now tracks the `bytewerk-labs/buttercup-core` fork.
- Pointed `repository`, `bugs`, `homepage` and the electron-builder `publish`
  target at `bytewerk-labs/buttercup-desktop`.
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

[Unreleased]: https://github.com/bytewerk-labs/buttercup-desktop/compare/v2.29.0...HEAD
[2.29.0]: https://github.com/bytewerk-labs/buttercup-desktop/compare/v2.28.1...v2.29.0
