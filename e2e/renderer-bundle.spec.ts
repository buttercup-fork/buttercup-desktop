import { readFileSync } from "fs";
import { join } from "path";
import { test, expect } from "@playwright/test";

/**
 * The window's bundle is built for the web (B-475): the only thing it may still take
 * from Node/Electron is the message channel. A library that starts needing a Node
 * built-in shows up here as a `require` in the bundle (and, before the window runs
 * without Node access, as a crash there).
 */
test("the window's bundle requires nothing but electron", () => {
    const bundle = readFileSync(join(__dirname, "../build/renderer/index.js"), "utf8");
    const required = new Set(
        [...bundle.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1])
    );
    expect([...required]).toEqual(["electron"]);
});
