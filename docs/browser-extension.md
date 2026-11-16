# Browser extension

The Buttercup browser extension fills logins and OTP codes on websites, and offers to save new logins, using the vaults in this desktop app. It works in Chrome, Firefox, Edge and Brave. Install it from the links in the [extension's README](https://github.com/buttercup-fork/buttercup-browser-extension#readme) (Edge and Brave use the Chrome Web Store version).

The extension keeps no copy of your vaults. It asks the desktop app for what it needs, over an encrypted connection on your own computer, so **the desktop app has to be running** (it can sit in the background) and the vault has to be unlocked.

## Connect (pair) the extension

1. In Buttercup, turn on **Connection → Enable browser access** (or **Preferences → Connectivity → Enable browser access**).
2. In the browser, open the extension's popup and click **Connect**.
3. Buttercup shows **Browser Access Request** with a code. Type that code into the extension.

Each browser is paired once. The code proves that the browser asking is the one you're sitting at: only accept a request you started yourself. If a **Browser Access Request** appears when you didn't click **Connect**, close it without using the code.

## What it can reach

A paired extension can read the entries of every vault that is **unlocked** in the desktop app, and save new logins into them when you agree to its prompt. Locked vaults are out of its reach. It can also lock a vault; any unsaved changes are saved first.

Browser access listens only on this computer (port 12822). Other computers on your network can't connect, and web pages can't start a pairing.

## Turn it off

Untick **Connection → Enable browser access**. The extension then can't reach Buttercup until you turn it on again.

## If it doesn't connect

- Check that Buttercup is running and **Enable browser access** is ticked.
- A firewall or security tool that blocks connections on this computer (`127.0.0.1`) can stop it.
- If the extension says the desktop app rejected the connection, use **Reset Application Data** in the extension's settings and connect again.
- Keep both up to date, and use the extension from this project rather than the original one.
