import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * A small user-flow test: with no vaults configured, the landing screen invites
 * you to add one, and clicking the button opens the "add vault" dialog.
 *
 * This is a good template to copy for testing other screens - launch the app,
 * find elements by their visible text, click, assert.
 */
test.describe("add vault landing", () => {
    let launched: LaunchedApp;

    test.beforeAll(async () => {
        launched = await launchApp();
    });

    test.afterAll(async () => {
        await launched?.close();
    });

    test("shows the empty-state call to action", async () => {
        const { window } = launched;
        await expect(window.getByText("A Fresh Start")).toBeVisible();
        await expect(window.getByRole("button", { name: "Add Vault" })).toBeVisible();
    });

    test("opens the add-vault dialog when the button is clicked", async () => {
        const { window } = launched;
        await window.getByRole("button", { name: "Add Vault" }).click();
        await expect(window.getByText("Choose a vault type to add:")).toBeVisible();
        // The four built-in source types should be offered.
        await expect(window.getByText("Dropbox")).toBeVisible();
        await expect(window.getByText("WebDAV")).toBeVisible();
    });
});
