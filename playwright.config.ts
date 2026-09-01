import { defineConfig } from "@playwright/test";

/**
 * Playwright configuration for Buttercup Desktop's end-to-end tests.
 *
 * The tests launch the real, packaged-style Electron app (from ./build) and
 * drive it like a user would. See ./e2e/README.md for a walkthrough.
 */
export default defineConfig({
    testDir: "./e2e",
    // A generous timeout: Electron can be slow to boot on CI.
    timeout: 60_000,
    expect: {
        timeout: 10_000
    },
    // Electron tests share a single app instance per file, so don't run the
    // tests within a file in parallel.
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
    use: {
        // Capture a trace on the first retry so failures are debuggable in the
        // Playwright trace viewer (`npx playwright show-trace`).
        trace: "on-first-retry",
        screenshot: "only-on-failure"
    }
});
