import fs from "fs";
import os from "os";
import path from "path";
import { copyAppData } from "./appData";

let root: string;
let from: { config: string; data: string };
let to: { config: string; data: string };

const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
};

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "buttercup-appdata-"));
    from = { config: path.join(root, "old", "config"), data: path.join(root, "old", "data") };
    to = { config: path.join(root, "new", "config"), data: path.join(root, "new", "data") };
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

test("copies settings, vault settings and the vault list", () => {
    write(path.join(from.config, "desktop.config.json"), '{"a":1}');
    write(path.join(from.config, "vault-config-abc.json"), "{}");
    write(path.join(from.config, "unrelated.txt"), "x");
    write(path.join(from.data, "vaults.json"), "[]");
    write(path.join(from.data, "backup", "old.bcup"), "x");
    const copied = copyAppData(from, to).map((file) => path.relative(root, file));
    expect(copied.sort()).toEqual(
        [
            path.join("new", "config", "desktop.config.json"),
            path.join("new", "config", "vault-config-abc.json"),
            path.join("new", "data", "vaults.json")
        ].sort()
    );
    expect(fs.readFileSync(path.join(to.config, "desktop.config.json"), "utf8")).toBe('{"a":1}');
    expect(fs.existsSync(path.join(to.config, "unrelated.txt"))).toBe(false);
    expect(fs.existsSync(path.join(to.data, "backup"))).toBe(false);
    // The originals stay
    expect(fs.existsSync(path.join(from.data, "vaults.json"))).toBe(true);
});

test("does nothing once the target has a vault list", () => {
    write(path.join(from.config, "desktop.config.json"), "old");
    write(path.join(to.data, "vaults.json"), "[]");
    expect(copyAppData(from, to)).toEqual([]);
    expect(fs.existsSync(path.join(to.config, "desktop.config.json"))).toBe(false);
});

test("does nothing once the target has settings", () => {
    write(path.join(from.data, "vaults.json"), "old");
    write(path.join(to.config, "desktop.config.json"), "new");
    expect(copyAppData(from, to)).toEqual([]);
    expect(fs.existsSync(path.join(to.data, "vaults.json"))).toBe(false);
});

test("copes with nothing to copy", () => {
    expect(copyAppData(from, to)).toEqual([]);
});
