import { EntryPropertyType } from "buttercup";
import { filterEntries, getDuplicateFieldIDs, keepFieldIDs } from "./entries";

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

describe("keepFieldIDs", () => {
    const field = (id: string, property: string, propertyType = EntryPropertyType.Property) => ({
        id,
        property,
        propertyType,
        value: "x"
    });
    const vault = (...entries: Array<any>) => ({ _tag: "t", entries }) as any;

    test("gives rebuilt fields the IDs they had", () => {
        const before = vault({ id: "e1", fields: [field("a", "title"), field("b", "notes")] });
        const after = vault({ id: "e1", fields: [field("x", "title"), field("y", "notes")] });
        const result = keepFieldIDs(before, after);
        expect(result.entries[0].fields.map((f: any) => f.id)).toEqual(["a", "b"]);
        expect(result._tag).toBe("t");
    });

    test("matches by type and name, whatever the order", () => {
        const before = vault({
            id: "e1",
            fields: [field("a", "title"), field("b", "title", EntryPropertyType.Attribute)]
        });
        const after = vault({
            id: "e1",
            fields: [field("y", "title", EntryPropertyType.Attribute), field("x", "title")]
        });
        const result = keepFieldIDs(before, after);
        expect(result.entries[0].fields.map((f: any) => f.id)).toEqual(["b", "a"]);
    });

    test("keeps IDs unique when a name is used twice", () => {
        const before = vault({ id: "e1", fields: [field("a", "pin"), field("b", "pin")] });
        const after = vault({ id: "e1", fields: [field("x", "pin"), field("y", "pin")] });
        const ids = keepFieldIDs(before, after).entries[0].fields.map((f: any) => f.id);
        expect(ids).toEqual(["a", "b"]);
    });

    test("a new, renamed or extra field keeps its own ID", () => {
        const before = vault({ id: "e1", fields: [field("a", "title")] });
        const after = vault({
            id: "e1",
            fields: [field("x", "title"), field("y", "recovery"), field("z", "title")]
        });
        const ids = keepFieldIDs(before, after).entries[0].fields.map((f: any) => f.id);
        expect(ids).toEqual(["a", "y", "z"]);
    });

    test("a new entry, saved without an ID, keeps its fields' IDs once it gets one", () => {
        const before = vault(
            { id: null, parentID: "g1", fields: [field("a", "title"), field("b", "notes")] },
            { id: "e9", parentID: "g1", fields: [field("c", "title")] }
        );
        const after = vault(
            { id: "e1", parentID: "g1", fields: [field("x", "title"), field("y", "notes")] },
            { id: "e9", parentID: "g1", fields: [field("z", "title")] }
        );
        const result = keepFieldIDs(before, after);
        expect(result.entries[0].fields.map((f: any) => f.id)).toEqual(["a", "b"]);
        expect(result.entries[1].fields.map((f: any) => f.id)).toEqual(["c"]);
    });

    test("an unsaved entry is only matched to an entry with the same group and title", () => {
        const withTitle = (id: string, parentID: string, title: string) => ({
            id: id === "?" ? null : id,
            parentID,
            fields: [
                {
                    id: `f-${id}-${title}`,
                    property: "title",
                    propertyType: EntryPropertyType.Property,
                    value: title
                }
            ]
        });
        const before = vault(withTitle("?", "g1", "Bank"));
        const after = vault(withTitle("e1", "g2", "Bank"), withTitle("e2", "g1", "Mail"));
        const result = keepFieldIDs(before, after);
        expect(result.entries.map((e: any) => e.fields[0].id)).toEqual(["f-e1-Bank", "f-e2-Mail"]);
    });

    test("leaves entries that weren't there before alone", () => {
        const before = vault({ id: "e1", fields: [field("a", "title")] });
        const after = vault({ id: "e2", fields: [field("x", "title")] });
        expect(keepFieldIDs(before, after).entries[0].fields[0].id).toBe("x");
    });

    test("does not change its inputs", () => {
        const before = vault({ id: "e1", fields: [field("a", "title")] });
        const after = vault({ id: "e1", fields: [field("x", "title")] });
        keepFieldIDs(before, after);
        expect(after.entries[0].fields[0].id).toBe("x");
    });
});
