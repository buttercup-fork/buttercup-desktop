import path from "path";
import { getVaultLocationKey } from "./vaultLocation";

const file = (filePath: string) => getVaultLocationKey({ type: "file", path: filePath });

test("the same file gives the same key", () => {
    const vault = path.resolve("vaults", "work.bcup");
    expect(file(vault)).toBe(file(vault));
    expect(file(vault)).toBe(file(path.join(path.dirname(vault), ".", "work.bcup")));
    expect(file(vault)).not.toBe(file(path.resolve("vaults", "home.bcup")));
});

test("ignores letter case on Windows and macOS only", () => {
    const vault = path.resolve("vaults", "work.bcup");
    const same = file(vault) === file(vault.toUpperCase());
    expect(same).toBe(process.platform === "win32" || process.platform === "darwin");
});

test("doesn't put the location in the key", () => {
    const key = file(path.resolve("secret-folder", "vault.bcup"));
    expect(key).toMatch(/^[0-9a-f]{64}$/);
});

test("WebDAV: same server, path and user", () => {
    const dav = (endpoint: string, filePath: string, username = "me") =>
        getVaultLocationKey({ type: "webdav", endpoint, path: filePath, username, password: "x" });
    expect(dav("https://dav.example.com/remote/", "/vaults/a.bcup")).toBe(
        dav("https://DAV.example.com/remote", "vaults/a.bcup")
    );
    expect(dav("https://dav.example.com/remote", "/vaults/a.bcup")).not.toBe(
        dav("https://dav.example.com/remote", "/vaults/b.bcup")
    );
    expect(dav("https://dav.example.com/remote", "/a.bcup", "me")).not.toBe(
        dav("https://dav.example.com/remote", "/a.bcup", "you")
    );
});

test("Google Drive: the file ID", () => {
    const drive = (fileID: string, token: string) =>
        getVaultLocationKey({ type: "googledrive", fileID, token, refreshToken: "r" });
    expect(drive("abc", "t1")).toBe(drive("abc", "t2"));
    expect(drive("abc", "t1")).not.toBe(drive("def", "t1"));
});

test("no key when the location can't be identified", () => {
    expect(getVaultLocationKey({ type: "dropbox", path: "/a.bcup", token: "t" })).toBeNull();
    expect(getVaultLocationKey({ type: "file" })).toBeNull();
    expect(getVaultLocationKey(null)).toBeNull();
});
