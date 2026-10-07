import { readFileSync } from "fs";
import { join } from "path";
import { test, expect } from "@playwright/test";

/**
 * The window's bundle is built for the web (B-475): it runs without Node access, so it
 * must not need any Node built-in. A library that starts needing one shows up here as a
 * `require` in the bundle.
 */
test("the window's bundle requires nothing", () => {
    const bundle = readFileSync(join(__dirname, "../build/renderer/index.js"), "utf8");
    const required = new Set(
        [...bundle.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1])
    );
    expect([...required]).toEqual([]);
});
