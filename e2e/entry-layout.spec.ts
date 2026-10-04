import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * In a narrow details pane, field values were split letter by letter next to
 * their labels (#1329): there the label now goes above the value.
 */
test.describe("entry details layout", () => {
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
    });

    test.afterAll(async () => {
        await launched?.close();
        rmSync(vaultDir, { recursive: true, force: true });
    });

    test("keeps values whole in a narrow pane and beside their labels in a wide one", async () => {
        const { app, window } = launched;
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        const setWidth = (width: number) =>
            app.evaluate(
                ({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setSize(w, 700),
                width
            );
        await setWidth(900);
        await window.getByRole("button", { name: "Add Vault" }).click();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await window.getByRole("button", { name: "New Entry" }).click();
        await expect(window.getByPlaceholder("Title")).toBeFocused();
        await window.getByPlaceholder("Title").fill("Bank");
        await window.getByPlaceholder("Username").fill("alice@example.com");
        await window.getByRole("button", { name: "Save" }).click();
        // Select the entry once the save has finished: a save still finishing
        // can drop the selection
        await expect(window.getByText("Vault saved").first()).toBeVisible();
        await window.getByText("Bank", { exact: true }).first().click();
        await expect(window.getByRole("button", { name: "Edit" })).toBeVisible();
        const label = window.getByText("Username", { exact: true });
        const value = window.getByText("alice@example.com", { exact: true }).last();
        // Narrow: label above the value, value on one line
        await expect(async () => {
            const labelBox = (await label.boundingBox())!;
            const valueBox = (await value.boundingBox())!;
            expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(valueBox.y + 1);
            expect(valueBox.height).toBeLessThan(30);
        }).toPass();
        // Wide: label beside the value
        await setWidth(1600);
        await expect(async () => {
            const labelBox = (await label.boundingBox())!;
            const valueBox = (await value.boundingBox())!;
            expect(valueBox.x).toBeGreaterThan(labelBox.x + labelBox.width);
            expect(Math.abs(valueBox.y - labelBox.y)).toBeLessThan(15);
        }).toPass();
    });
});
