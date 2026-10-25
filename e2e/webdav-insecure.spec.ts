import { test, expect } from "@playwright/test";
import { join } from "path";
import { launchApp, type LaunchedApp } from "./helpers";

/**
 * B-684: a WebDAV address on plain http to another computer sends the
 * username and password in clear text. The add-vault form must warn, and send
 * nothing (no connection test, no file listing) until the user allows it.
 */
test.describe("WebDAV over plain http", () => {
    let launched: LaunchedApp;
    // TEST-NET-1 (RFC 5737): never a real host
    const insecureURL = "http://192.0.2.1/remote.php/dav";
    const sent: Array<string> = [];

    test.beforeAll(async () => {
        launched = await launchApp();
        launched.window.on("request", (request) => {
            if (request.url().includes("192.0.2.1")) sent.push(request.url());
        });
    });

    test.afterAll(async () => {
        await launched?.close();
    });

    const setThemeSource = (source: "dark" | "light") =>
        launched.app.evaluate(({ nativeTheme }, value) => {
            nativeTheme.themeSource = value;
        }, source);

    const urlField = () => launched.window.getByPlaceholder("https://...");
    const nextButton = () => launched.window.getByRole("button", { name: "Next" });
    const warning = () => launched.window.getByTestId("webdav-insecure-warning");
    const allowBox = () => launched.window.getByLabel("Allow unencrypted connection");

    test("opens the WebDAV form", async () => {
        const { window } = launched;
        await window.getByRole("button", { name: "Add Vault" }).click();
        await window.getByText("WebDAV").click();
        await expect(urlField()).toBeVisible();
        await expect(warning()).toHaveCount(0);
    });

    test("warns about an http address and blocks Next", async () => {
        await urlField().fill(insecureURL);
        await launched.window.getByPlaceholder("WebDAV Username").fill("alice");
        await launched.window.getByPlaceholder("WebDAV Password").fill("webdav-secret");
        await expect(warning()).toBeVisible();
        await expect(warning()).toContainText("Unencrypted connection");
        await expect(allowBox()).not.toBeChecked();
        await expect(nextButton()).toBeDisabled();
    });

    test("Enter does not send anything either", async () => {
        await launched.window.getByPlaceholder("WebDAV Password").press("Enter");
        await expect(
            launched.window.getByText("This address uses unencrypted http.", { exact: false })
        ).toBeVisible();
        await expect(urlField()).toBeVisible();
        expect(sent).toEqual([]);
    });

    test("light and dark screenshots of the warning", async () => {
        for (const theme of ["light", "dark"] as const) {
            await setThemeSource(theme);
            await expect(launched.window.locator("body.bp4-dark")).toHaveCount(theme === "dark" ? 1 : 0);
            await launched.window.screenshot({
                path: join(__dirname, "..", "test-results", `webdav-insecure-${theme}.png`)
            });
        }
        await setThemeSource("light");
    });

    test("ticking the box enables Next", async () => {
        // Blueprint hides the native input behind its own box: click the label,
        // as a user does
        await launched.window.getByText("Allow unencrypted connection", { exact: true }).click();
        await expect(allowBox()).toBeChecked();
        await expect(nextButton()).toBeEnabled();
    });

    test("changing the address clears the OK", async () => {
        await urlField().fill("http://192.0.2.2/dav");
        await expect(allowBox()).not.toBeChecked();
        await expect(nextButton()).toBeDisabled();
    });

    test("no warning for https or this computer", async () => {
        for (const url of ["https://192.0.2.1/dav", "http://localhost:8080/dav", "http://127.0.0.1/dav"]) {
            await urlField().fill(url);
            await expect(warning()).toHaveCount(0);
            await expect(nextButton()).toBeEnabled();
        }
        expect(sent).toEqual([]);
    });
});
