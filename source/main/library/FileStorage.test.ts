import fs from "fs";
import os from "os";
import path from "path";

import { FileStorage } from "./FileStorage";

let dir: string;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bcup-filestorage-"));
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

test("returns an empty object when the file does not exist", async () => {
    const storage = new FileStorage(path.join(dir, "missing.json"));
    await expect(storage.getValues()).resolves.toEqual({});
});

test("reads and writes values", async () => {
    const file = path.join(dir, "config.json");
    const storage = new FileStorage(file);
    await storage.setValue("a", 1);
    await storage.setValue("b", "two");
    expect(await storage.getValue("a")).toBe(1);
    expect(await storage.getValue("b")).toBe("two");
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ a: 1, b: "two" });
});

test("recovers from an empty (truncated) file instead of throwing", async () => {
    const file = path.join(dir, "config.json");
    fs.writeFileSync(file, "");
    const storage = new FileStorage(file);
    await expect(storage.getValues()).resolves.toEqual({});
    // The corrupt file is moved aside, not left in place.
    expect(fs.existsSync(file)).toBe(false);
    const backups = fs.readdirSync(dir).filter((name) => name.includes(".corrupt-"));
    expect(backups).toHaveLength(1);
});

test("recovers from invalid JSON and can be written to afterwards", async () => {
    const file = path.join(dir, "config.json");
    fs.writeFileSync(file, "{not valid json");
    const storage = new FileStorage(file);
    expect(await storage.getValues()).toEqual({});
    await storage.setValue("fresh", true);
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ fresh: true });
});

test("does not leave a temp file behind after a write", async () => {
    const file = path.join(dir, "config.json");
    const storage = new FileStorage(file);
    await storage.setValue("a", 1);
    const temps = fs.readdirSync(dir).filter((name) => name.includes(".tmp-"));
    expect(temps).toHaveLength(0);
});
