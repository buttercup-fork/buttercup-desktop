# Buttercup Desktop user guide

This guide covers Buttercup Desktop 3.0.0 on **Windows** and **Linux**. macOS builds are not part of 3.0.0; they will follow in a later release.

Buttercup keeps your passwords and other secrets in an encrypted vault file (`.bcup`). Only your master password opens it. The vault can live on your computer, in Dropbox, in Google Drive or on a WebDAV server, and the browser extension can fill logins from it while the desktop app runs.

## Pages

1. [Install and verify a download](install.md)
2. [Moving from the original Buttercup](moving-from-upstream.md)
3. [Your first vault](getting-started.md)
4. [Storing a vault: local file, Dropbox, Google Drive, WebDAV](vault-storage.md)
5. [Browser extension](browser-extension.md)
6. [Import and export](import-export.md)
7. [Security settings](security-settings.md)
8. [Troubleshooting](troubleshooting.md)

## Two rules that matter most

- **Nobody can recover a forgotten master password.** Not us, not anyone. Write it down somewhere safe offline if you need to, and keep backups of the vault file.
- **No one from this project will ever ask for your vault or its password.** If you report a problem and we need a vault to reproduce it, make a test vault with made-up entries and a throwaway password.

## Where else to look

- [`README.md`](../README.md): build formats, configuration files, command-line options, building from source.
- [`CHANGELOG.md`](../CHANGELOG.md): what changed in each version.
- Found a bug or a missing feature? Open an issue on this repository. Security problems: follow the security policy instead of opening a public issue.
