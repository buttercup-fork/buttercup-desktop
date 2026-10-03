import { EntryPropertyType } from "buttercup";
import { filterEntries, getDuplicateFieldIDs } from "./entries";

const entry = (id: string, fields: Record<string, string | null>) =>
    ({
        id,
        fields: [
            ...Object.entries(fields).map(([property, value]) => ({
                property,
                value,
                propertyType: EntryPropertyType.Property
            })),
            // An internal attribute that should never be matched against.
            {
                property: "BentryFacadeType",
                value: "login",
                propertyType: EntryPropertyType.Attribute
            }
        ]
    }) as any;

const entries = [
    entry("1", { title: "GitHub", username: "octocat", URL: "https://github.com" }),
    entry("2", { title: "Bank of Example", username: "customer", URL: "https://bank.example.com" }),
    entry("3", {
        title: "Identidad Digital",
        username: "ciudadano",
        URL: "https://identidad.example"
    }),
    entry("4", { title: "No creds site", username: null, URL: null })
];

test("returns everything for an empty or whitespace term", () => {
    expect(filterEntries(entries, "")).toHaveLength(4);
    expect(filterEntries(entries, "   ")).toHaveLength(4);
});

test("matches case-insensitively across field values", () => {
    expect(filterEntries(entries, "github").map((e) => e.id)).toEqual(["1"]);
    expect(filterEntries(entries, "OCTOCAT").map((e) => e.id)).toEqual(["1"]);
    expect(filterEntries(entries, "identidad").map((e) => e.id)).toEqual(["3"]);
});

test("requires every whitespace-separated token to match", () => {
    expect(filterEntries(entries, "bank example").map((e) => e.id)).toEqual(["2"]);
    expect(filterEntries(entries, "bank github")).toHaveLength(0);
});

test("does not throw on null field values", () => {
    expect(() => filterEntries(entries, "creds")).not.toThrow();
    expect(filterEntries(entries, "creds").map((e) => e.id)).toEqual(["4"]);
});

test("does not match internal attribute values", () => {
    expect(filterEntries(entries, "login")).toHaveLength(0);
});

describe("getDuplicateFieldIDs", () => {
    const field = (
        id: string,
        property: string,
        removeable = true,
        propertyType = EntryPropertyType.Property
    ) => ({ id, property, value: "", propertyType, removeable }) as any;

    test("is empty when all names are unique", () => {
        expect(
            getDuplicateFieldIDs([
                field("a", "title", false),
                field("b", "pin"),
                field("c", "account")
            ])
        ).toEqual(new Set());
    });

    test("flags a custom field that reuses a built-in name, not the built-in", () => {
        expect(
            getDuplicateFieldIDs([field("a", "password", false), field("b", "password")])
        ).toEqual(new Set(["b"]));
    });

    test("flags every custom field sharing a name", () => {
        expect(
            getDuplicateFieldIDs([field("a", "pin"), field("b", "account"), field("c", "pin")])
        ).toEqual(new Set(["a", "c"]));
    });

    test("ignores untitled fields and attributes", () => {
        expect(
            getDuplicateFieldIDs([
                field("a", ""),
                field("b", ""),
                field("c", "pin"),
                field("d", "pin", false, EntryPropertyType.Attribute)
            ])
        ).toEqual(new Set());
    });

    test("names are case-sensitive, like the vault's properties", () => {
        expect(getDuplicateFieldIDs([field("a", "url", false), field("b", "URL")])).toEqual(
            new Set()
        );
    });
});
