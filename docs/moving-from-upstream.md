# Moving from the original Buttercup

This is an independent fork of Buttercup Desktop. The original project was closed and is no longer maintained, so it gets no security fixes. This page is for anyone who used it.

## Your vaults

Your vault files (`.bcup`) stay where they are: on your disk, in Dropbox, in Google Drive or on your WebDAV server. This app opens them with the same master password.

This app also reads the original app's **vault list and settings**, because both use the same settings folder (`Buttercup-nodejs`, see the [README](../README.md#configuration)). After installing, your vaults are usually already listed.

## What changes for you

- **Uninstall the original app** once this one works for you, and don't run both. They share the vault list and settings, and the original has known security problems that are fixed here.
- **Google Drive vaults ask you to sign in once more.** This app uses its own Google sign-in. While that sign-in app is still in Google's Testing mode, see [the Google Drive notes](vault-storage.md#google-drive).
- **Use the fork's browser extension.** Install the Buttercup browser extension from this project ([buttercup-fork/buttercup-browser-extension](https://github.com/buttercup-fork/buttercup-browser-extension)) and pair it again. See [Browser extension](browser-extension.md).
- **A WebDAV vault on a plain `http` address asks once** whether to allow the unencrypted connection. See [WebDAV](vault-storage.md#webdav).
- **Your existing master password keeps working.** The new [master password rules](getting-started.md#the-master-password) apply only when you set a password.
- **Vaults get stronger encryption settings on their next save** (more key-derivation rounds and longer salts). Older versions of Buttercup Desktop, including the original app, can still open them.

## Can I go back?

Yes. Vault files stay readable by the original Buttercup. The original app has unfixed security problems, though, so we don't recommend it.
