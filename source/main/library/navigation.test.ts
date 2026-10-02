import { isAppURL, isSafeExternalURL } from "./navigation";

const APP_URL = "file:///C:/Program%20Files/Buttercup/resources/app.asar/build/renderer/index.html";

test("allows http, https and mailto links to open externally", () => {
    expect(isSafeExternalURL("https://github.com/login")).toBe(true);
    expect(isSafeExternalURL("http://192.168.1.10:8080/")).toBe(true);
    expect(isSafeExternalURL("mailto:someone@example.com")).toBe(true);
});

test("refuses schemes that can run programs or read local files", () => {
    expect(isSafeExternalURL("file:///C:/Windows/System32/calc.exe")).toBe(false);
    expect(isSafeExternalURL("smb://attacker.example/share/run.exe")).toBe(false);
    expect(isSafeExternalURL("ms-msdt:/id PCWDiagnostic")).toBe(false);
    expect(isSafeExternalURL("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalURL("github.com")).toBe(false);
});

test("treats hash routes on the app's own page as in-app", () => {
    expect(isAppURL(APP_URL, APP_URL)).toBe(true);
    expect(isAppURL(`${APP_URL}#/source/abc`, APP_URL)).toBe(true);
});

test("treats any other page as leaving the app", () => {
    expect(isAppURL("https://example.com/", APP_URL)).toBe(false);
    expect(isAppURL("file:///C:/Users/me/Downloads/page.html", APP_URL)).toBe(false);
    expect(isAppURL(`${APP_URL}?x=1`, APP_URL)).toBe(false);
});
