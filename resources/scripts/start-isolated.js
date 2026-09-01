/**
 * Launches the app against a throwaway data directory so a development build can
 * run alongside a personally-installed Buttercup without touching its config,
 * vault list, logs or single-instance lock.
 *
 *   npm run start:isolated
 *
 * The sandbox lives at <os tmpdir>/buttercup-dev (reused between runs so your
 * test vaults persist). Delete that folder for a clean slate.
 */
const { spawn } = require("child_process");
const { join } = require("path");
const { tmpdir } = require("os");
const { mkdirSync } = require("fs");

const sandboxDir = process.env.BUTTERCUP_DEV_HOME || join(tmpdir(), "buttercup-dev");
mkdirSync(sandboxDir, { recursive: true });

const electron = require("electron");

const child = spawn(
    electron,
    [join(__dirname, "..", ".."), `--user-data-dir=${join(sandboxDir, "electron")}`],
    {
        stdio: "inherit",
        env: {
            ...process.env,
            // storage.ts derives config/data/temp/log subfolders from this.
            BUTTERCUP_HOME_DIR: sandboxDir
        }
    }
);

child.on("close", (code) => process.exit(code ?? 0));
