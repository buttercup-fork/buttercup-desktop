import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * A new entry has no ID until the main process has saved it, so after saving
 * it nothing was selected ("No document selected"), and clicking it before
 * the save finished selected nothing either.
 */
test.describe("new entry selection", () => {
    let launched: LaunchedApp;
    let vaultDir: string;

    test.beforeAll(async () => {
        launched = await launchApp();
        vaultDir = mkdtempSync(join(tmpdir(), "buttercup-e2e-vault-"));
        // Stand in for the native "new vault" save dialog
        await launched.app.evaluate(
            ({ dialog }, filePath) => {
                dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as any;
            },
            join(vaultDir, "test.bcup")
        );
        const { window } = launched;
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        await window.getByRole("button", { name: "Add Vault" }).click();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
    });

    test.afterAll(async () => {
        await launched?.close();
        rmSync(vaultDir, { recursive: true, force: true });
    });

    test("selects a new entry once it's saved", async () => {
        const { window } = launched;
        await window.getByRole("button", { name: "New Entry" }).click();
        await expect(window.getByPlaceholder("Title")).toBeFocused();
        await window.getByPlaceholder("Title").fill("Bank");
        await window.getByRole("button", { name: "Save" }).click();
        await expect(window.getByRole("button", { name: "Edit" })).toBeVisible();
        await expect(window.getByText("No document selected")).toHaveCount(0);
        await expect(window.getByText("Bank", { exact: true }).last()).toBeVisible();
    });

    test("keeps a click on the new entry made before its save finished", async () => {
        const { window } = launched;
        await window.getByRole("button", { name: "New Entry" }).click();
        await expect(window.getByPlaceholder("Title")).toBeFocused();
        await window.getByPlaceholder("Title").fill("Mail");
        await window.getByRole("button", { name: "Save" }).click();
        await window.getByText("Mail", { exact: true }).first().click();
        await expect(window.getByRole("button", { name: "Edit" })).toBeVisible();
        // Still selected after the save's vault update has arrived
        await expect(window.getByText("Vault saved").first()).toBeVisible();
        await window.waitForTimeout(1000);
        await expect(window.getByRole("button", { name: "Edit" })).toBeVisible();
        await window.getByRole("button", { name: "Edit" }).click();
        await expect(window.getByPlaceholder("Title")).toHaveValue("Mail");
    });
});
