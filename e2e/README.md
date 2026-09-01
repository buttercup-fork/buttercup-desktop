# End-to-end (UI) tests

These tests launch the **real Buttercup desktop app** (built into `../build`)
and drive it the way a user would — clicking buttons, typing, reading the
screen. They use [Playwright](https://playwright.dev/), which has first-class
support for Electron.

You do **not** need Visual Studio or any IDE. Just Node.js and this repo.

## Running the tests

```bash
# Builds the app first, then runs every test in this folder:
npm run test:e2e

# Interactive mode — a UI where you can pick tests, watch them run in a
# real window, step through actions, and see the DOM. Best while writing tests:
npm run test:e2e:ui

# If the app is already built (npm run build) and you just want to re-run:
npm run test:e2e:run
npx playwright test e2e/smoke.spec.ts          # a single file
npx playwright test -g "opens the add-vault"    # tests matching a title
```

First run only, Playwright downloads its helper binaries:

```bash
npx playwright install
```

### VS Code (optional but recommended for beginners)

Install the **"Playwright Test for VSCode"** extension. You then get:

- a green ▶ next to every test to run/debug it
- breakpoints inside test code
- a "Record new test" button that writes clicks for you as you use the app

## What's here

| File            | What it checks                                                        |
| --------------- | -------------------------------------------------------------------- |
| `smoke.spec.ts` | The app boots, opens one window, renders React, no console errors.   |
| `add-vault.spec.ts` | The empty-state landing screen and the "add vault" dialog.       |
| `helpers.ts`    | `launchApp()` — starts the app fully isolated from your real Buttercup. Reuse it. |

## Isolation

`launchApp()` sets `BUTTERCUP_HOME_DIR` to a fresh temp folder and passes
`--user-data-dir`, so the tests never touch your personal Buttercup config,
vault list, logs, or its single-instance lock. You can run the tests while your
installed Buttercup is open.

For **manual** development runs with the same isolation, use:

```bash
npm run start:isolated
```

That reuses `<tmp>/buttercup-dev` between runs (delete it for a clean slate).

## Writing a new test

Copy `add-vault.spec.ts`. The pattern is always:

```ts
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

test.describe("my feature", () => {
    let launched: LaunchedApp;
    test.beforeAll(async () => { launched = await launchApp(); });
    test.afterAll(async () => { await launched?.close(); });

    test("does the thing", async () => {
        const { window } = launched;             // `window` is a Playwright Page
        await window.getByRole("button", { name: "Add Vault" }).click();
        await expect(window.getByText("Choose a vault type to add:")).toBeVisible();
    });
});
```

Prefer locating elements by what the user sees — `getByRole`, `getByText`,
`getByLabel` — over CSS selectors. See the
[Playwright locators guide](https://playwright.dev/docs/locators).

## When a test fails

- `npm run test:e2e:ui` and watch it happen.
- After a failed `npm run test:e2e`, open the report: `npx playwright show-report`.
- Failures automatically capture a screenshot; retried failures also capture a
  trace you can open with `npx playwright show-trace test-results/.../trace.zip`.

## CI / headless machines

Electron needs a display server. On a Linux CI runner wrap the command:

```bash
xvfb-run -a npm run test:e2e
```

and set `CI=1` (the launcher then adds `--no-sandbox --disable-gpu` etc.).
On a headless Windows VM without a GPU, set `BUTTERCUP_E2E_HEADLESS=1` to get
the same flags.
