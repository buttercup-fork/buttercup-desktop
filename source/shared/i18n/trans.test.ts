import fs from "fs";
import path from "path";

// B-712: values in translations are not HTML-escaped, because the text is shown
// as text. That is only safe while no string that goes into
// dangerouslySetInnerHTML takes a value: checked here for every language.

// Jest runs from the repository root (ESM: no __dirname)
const TRANSLATIONS = path.resolve("source/shared/i18n/translations");
const RENDERER = path.resolve("source/renderer");

let t: typeof import("./trans").t;

beforeAll(async () => {
    const trans = await import("./trans");
    await trans.initialise("en");
    t = trans.t;
});

function sourceFiles(dir: string): Array<string> {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) return sourceFiles(full);
        return /\.tsx?$/.test(item.name) ? [full] : [];
    });
}

function lookup(translations: any, key: string): unknown {
    return key.split(".").reduce((node, part) => (node ? node[part] : undefined), translations);
}

test("values are not HTML-escaped (B-712)", () => {
    const message = t("notification.error.import-failed", { error: `open 'C:\\x.csv' <"a" & b>` });
    expect(message).toBe(`Failed importing: open 'C:\\x.csv' <"a" & b>`);
});

test("strings rendered as HTML take no values, in every language", () => {
    const sinks = sourceFiles(RENDERER).flatMap((file) => {
        const source = fs.readFileSync(file, "utf8");
        const all = source.match(/__html:\s*t\(/g) ?? [];
        // Only the plain form t("key") is allowed: no options, no variable key
        const plain = [...source.matchAll(/__html:\s*t\("([^"]+)"\)/g)].map((match) => match[1]);
        expect({ file, count: plain.length }).toEqual({ file, count: all.length });
        return plain;
    });
    expect(sinks.length).toBeGreaterThan(0);
    const languages = fs.readdirSync(TRANSLATIONS).filter((name) => name.endsWith(".json"));
    expect(languages.length).toBeGreaterThan(1);
    let checked = 0;
    languages.forEach((name) => {
        const translations = JSON.parse(fs.readFileSync(path.join(TRANSLATIONS, name), "utf8"));
        sinks.forEach((key) => {
            const value = lookup(translations, key);
            if (typeof value !== "string") return;
            checked += 1;
            expect({ name, key, interpolates: /\{\{|\$t\(/.test(value) }).toEqual({
                name,
                key,
                interpolates: false
            });
        });
    });
    // The English file has every key
    expect(checked).toBeGreaterThanOrEqual(sinks.length);
});
