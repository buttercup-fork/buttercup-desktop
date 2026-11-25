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

describe("plurals (B-815)", () => {
    afterAll(async () => {
        const trans = await import("./trans");
        await trans.changeLanguage("en");
    });

    // i18next 25 changed how changeLanguage matches a language code: every code
    // the app offers must still show its own strings
    test("switching to each language shows that language's strings", async () => {
        const trans = await import("./trans");
        const { default: translations } = await import("./translations/index");
        const en = (translations as Record<string, any>).en;
        const leaves = (node: any, prefix = ""): Array<[string, string]> =>
            Object.entries(node).flatMap(([key, value]) =>
                typeof value === "string"
                    ? [[`${prefix}${key}`, value] as [string, string]]
                    : leaves(value, `${prefix}${key}.`)
            );
        const langs = Object.keys(translations).filter((lang) => lang !== "en");
        expect(langs.length).toBeGreaterThanOrEqual(16);
        for (const lang of langs) {
            const own = leaves((translations as Record<string, any>)[lang]).find(
                ([key, value]) =>
                    !/\{\{|\$t\(|_(one|few|many|other|two|zero)$/.test(key + value) &&
                    lookup(en, key) !== value
            );
            expect({ lang, found: !!own }).toEqual({ lang, found: true });
            await trans.changeLanguage(lang);
            expect({ lang, key: own![0], text: t(own![0]) }).toEqual({
                lang,
                key: own![0],
                text: own![1]
            });
        }
    });

    test("the tray's vault count is singular for 1 and plural otherwise, in English", async () => {
        const trans = await import("./trans");
        await trans.changeLanguage("en");
        expect(t("app-menu.unlocked-vaults", { count: 1 })).toBe("1 unlocked vault");
        expect(t("app-menu.unlocked-vaults", { count: 2 })).toBe("2 unlocked vaults");
        expect(t("app-menu.unlocked-vaults", { count: 0 })).toBe("0 unlocked vaults");
    });

    // i18next 21+ reads _one/_other/... keys (the v3 "_plural" key is ignored), and a
    // plural form a language needs but lacks shows the English text instead
    test("every language with the tray's vault count has each plural form it needs", async () => {
        const trans = await import("./trans");
        const { default: translations } = await import("./translations/index");
        let checked = 0;
        for (const [lang, strings] of Object.entries(translations as Record<string, any>)) {
            const menu = strings["app-menu"] ?? {};
            const own = Object.keys(menu)
                .filter((key) => key.startsWith("unlocked-vaults"))
                .map((key) => menu[key] as string);
            if (own.length === 0) continue;
            expect({
                lang,
                legacy: "unlocked-vaults_plural" in menu || "unlocked-vaults" in menu
            }).toEqual({
                lang,
                legacy: false
            });
            await trans.changeLanguage(lang);
            for (const count of [1, 2, 5, 22, 100, 1000000]) {
                const text = t("app-menu.unlocked-vaults", { count });
                const fromOwn = own.some(
                    (value) => value.replace("{{count}}", String(count)) === text
                );
                expect({ lang, count, text, fromOwn }).toEqual({
                    lang,
                    count,
                    text,
                    fromOwn: true
                });
                checked += 1;
            }
        }
        expect(checked).toBeGreaterThanOrEqual(14 * 6);
    });
});

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
