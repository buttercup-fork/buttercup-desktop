import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * Copies from a vault are marked confidential on Windows, so clipboard history
 * (Win+V) and cloud clipboard sync skip them (B-8).
 */
test.describe("concealed clipboard copies", () => {
    test.skip(process.platform !== "win32", "Concealed copies are Windows-only for now");

    let launched: LaunchedApp;
    let vaultDir: string;
    const clip = () => launched.app.evaluate(({ clipboard }) => clipboard.readText());
    // Ask Windows itself which formats the clipboard holds
    const clipboardFormats = () =>
        execFileSync(
            "powershell.exe",
            [
                "-NoProfile",
                "-STA",
                "-Command",
                "Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.Clipboard]::GetDataObject().GetFormats() -join ','"
            ],
            { encoding: "utf8" }
        )
            .trim()
            .split(",");

    test.beforeAll(async () => {
        launched = await launchApp();
        vaultDir = mkdtempSync(join(tmpdir(), "buttercup-e2e-vault-"));
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

    test("a copied password is kept out of clipboard history", async () => {
        const { window } = launched;
        const passwordPrompt = window.getByPlaceholder("Vault password...");
        await window.getByRole("button", { name: "Add Vault" }).click();
        await window.getByText("File", { exact: true }).click();
        await window.getByRole("button", { name: "Create New" }).click();
        await passwordPrompt.fill("pass");
        await passwordPrompt.press("Enter");
        await window.getByRole("button", { name: "New Entry" }).click();
        await expect(window.getByPlaceholder("Title")).toBeFocused();
        await window.getByPlaceholder("Title").fill("Bank");
        await window.getByPlaceholder("Username").fill("alice");
        await window.getByPlaceholder("Password", { exact: true }).fill("s3cret-ü");
        await window.getByRole("button", { name: "Save" }).click();
        await expect(window.getByText("Vault saved").first()).toBeVisible();
        await window.getByText("Bank", { exact: true }).first().click();
        await window.keyboard.press("Control+c");
        await expect.poll(clip).toBe("s3cret-ü");
        const formats = clipboardFormats();
        expect(formats).toContain("ExcludeClipboardContentFromMonitorProcessing");
        expect(formats).toContain("CanIncludeInClipboardHistory");
        expect(formats).toContain("CanUploadToCloudClipboard");
    });
});
