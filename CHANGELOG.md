# Changelog

All notable changes to this fork of Buttercup Desktop are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release history up to and including **2.28.1** predates this file and lives in the [git tags](https://github.com/ByteWurst-Labs/buttercup-desktop/tags) and the original project's GitHub Releases.

## [Unreleased]

Modernization work on the `rewrite/electron-modernize` branch.

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
- The `buttercup` dependency now tracks the `ByteWurst-Labs/buttercup-core` fork.
- Pointed `repository`, `bugs`, `homepage` and the electron-builder `publish`
  target at `bytewurst-labs/buttercup-desktop`.
- Migrated the `build` config for electron-builder 26: `linux.desktop` entries
  moved under `desktop.entry`; `win.sign` / `win.publisherName` moved under
  `win.signtoolOptions`; `mac.notarize` is now a boolean (set to `false` — set it
  to `true` with `APPLE_TEAM_ID=9D8F4J769D` and the other Apple env vars to
  notarize).
- `resources/scripts/windowsSign.js` now skips signing (unsigned build) when
  `WIN_YUBIKEY_PIN` is unset instead of throwing, so `npm run package:win` works
  without the signing key.
- `resources/scripts/afterAllArtifactBuild.js` (macOS-only) now requires
  `js-yaml` / `app-builder-bin` lazily; added both as devDependencies so Windows
  and Linux packaging no longer fail on the missing module.

### Added

- End-to-end UI tests with Playwright (`e2e/`, `playwright.config.ts`). Run with `npm run test:e2e` (or `npm run test:e2e:ui` for the interactive runner). See [`e2e/README.md`](e2e/README.md).
- `npm run start:isolated` — runs a development build against a throwaway data directory so it can coexist with a personally-installed Buttercup without touching its config, vault list or logs.
- This `CHANGELOG.md`.

[Unreleased]: https://github.com/ByteWurst-Labs/buttercup-desktop/compare/v2.28.1...HEAD
