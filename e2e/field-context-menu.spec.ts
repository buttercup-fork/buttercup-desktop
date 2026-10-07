import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { test, expect } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * Right-clicking a field value offers Copy, like the field's clipboard button (#773, B-19).
 */
test.describe("field context menu", () => {
    let launched: LaunchedApp;
    let vaultDir: string;
    const clip = () => launched.app.evaluate(({ clipboard }) => clipboard.readText());

    test.beforeAll(async () => {
        launched = await launchApp();
        vaultDir = mkdtempSync(join(tmpdir(), "buttercup-e2e-vault-"));
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
        await window.getByRole("button", { name: "New Entry" }).click();
        await expect(window.getByPlaceholder("Title")).toBeFocused();
        await window.getByPlaceholder("Title").fill("Bank");
        await window.getByPlaceholder("Username").fill("alice");
        await window.getByPlaceholder("Password", { exact: true }).fill("s3cret");
        await window.getByRole("button", { name: "Save" }).click();
        await expect(window.getByText("Vault saved").first()).toBeVisible();
    });

    test.afterAll(async () => {
        await launched?.close();
        rmSync(vaultDir, { recursive: true, force: true });
    });

    test("right-click on a field value copies it", async () => {
        const { window } = launched;
        await window.getByText("Bank", { exact: true }).first().click();
        await launched.app.evaluate(({ clipboard }) => clipboard.writeText("before"));
        const username = window.locator('[role="content"]', { hasText: "alice" });
        await username.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Copy" }).click();
        await expect.poll(clip).toBe("alice");
    });

    test("a hidden password is copied, not its dots", async () => {
        const { window } = launched;
        const password = window.locator('[role="content"]', { hasText: "●●●●●●●●" });
        await password.click({ button: "right" });
        await window.getByRole("menuitem", { name: "Copy" }).click();
        await expect.poll(clip).toBe("s3cret");
    });
});
