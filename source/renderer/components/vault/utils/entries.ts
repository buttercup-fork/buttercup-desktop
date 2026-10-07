import { EntryFacade, EntryPropertyType } from "buttercup";

export const filterEntries = (entries: Array<EntryFacade> = [], term = ""): Array<EntryFacade> => {
    const tokens = term.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
        return entries;
    }
    // A plain, synchronous substring filter over the entry's visible field
    // values. (The previous implementation used `VaultFacadeEntrySearch`, whose
    // `prepare()` step is async and was never awaited - so `searchByTerm` threw
    // "Searching interface not prepared" the moment you typed.) The `typeof`
    // guard also keeps a null field value - e.g. from a rough import - from
    // blowing up the filter.
    return entries.filter((entry) => {
        const haystack = entry.fields
            .filter((field) => field.propertyType === EntryPropertyType.Property)
            .map((field) => (typeof field.value === "string" ? field.value.toLowerCase() : ""))
            .join(" ");
        return tokens.every((token) => haystack.includes(token));
    });
};

/**
 * IDs of custom fields whose name is already used by another property field of
 * the same entry. Saving such an entry would keep only the last field's value
 * (core applies the fields one by one), silently erasing the other (#1159).
 */
export function getDuplicateFieldIDs(fields: EntryFacade["fields"] = []): Set<string> {
    const properties = fields.filter(
        (field) => field.propertyType === EntryPropertyType.Property && field.property
    );
    const counts = new Map<string, number>();
    properties.forEach((field) => {
        counts.set(field.property, (counts.get(field.property) ?? 0) + 1);
    });
    return new Set(
        properties
            .filter((field) => field.removeable && counts.get(field.property)! > 1)
            .map((field) => field.id)
    );
}

export function sortEntries(entries: Array<EntryFacade> = [], asc = true) {
    return entries.sort((a, b) => {
        const aTitleProp = a.fields.find(
            (f) => f.property === "title" && f.propertyType === EntryPropertyType.Property
        );
        const bTitleProp = b.fields.find(
            (f) => f.property === "title" && f.propertyType === EntryPropertyType.Property
        );
        const aTitle = aTitleProp?.value ?? "";
        const bTitle = bTitleProp?.value ?? "";
        if (aTitle < bTitle) {
            return asc ? -1 : 1;
        } else if (aTitle > bTitle) {
            return asc ? 1 : -1;
        }
        return 0;
    });
}

const getTitle = (entry: EntryFacade): string =>
    entry.fields.find(
        (field) => field.propertyType === EntryPropertyType.Property && field.property === "title"
    )?.value ?? "";

/**
 * Give the fields of a rebuilt vault facade the IDs they had before. Core makes
 * new random field IDs every time it builds an entry facade, and the entry view
 * keys its rows by field ID, so after a save every row was remounted: a note
 * you had expanded or a password you had revealed snapped back. Fields are
 * matched by entry, then by type and name (in order, for repeated names); a field
 * without a match keeps its new ID. A new entry has no ID until the vault is
 * rebuilt after its save, so it is matched to the unsaved entry with the same
 * group and title.
 * @param previous The vault facade that was showing
 * @param next The rebuilt vault facade
 * @returns The rebuilt facade, with the previous field IDs where they match
 */
export function keepFieldIDs<T extends { entries: Array<EntryFacade> }>(previous: T, next: T): T {
    const previousByID = new Map<string, EntryFacade>();
    const unsaved: Array<EntryFacade> = [];
    for (const entry of previous.entries) {
        if (entry.id) previousByID.set(entry.id, entry);
        else unsaved.push(entry);
    }
    return {
        ...next,
        entries: next.entries.map((entry) => {
            let before = entry.id ? previousByID.get(entry.id) : undefined;
            if (!before && entry.id) {
                const index = unsaved.findIndex(
                    (candidate) =>
                        candidate.parentID === entry.parentID &&
                        getTitle(candidate) === getTitle(entry)
                );
                if (index >= 0) [before] = unsaved.splice(index, 1);
            }
            if (!before) return entry;
            const available = new Map<string, Array<string>>();
            for (const field of before.fields) {
                const key = `${field.propertyType}|${field.property}`;
                const ids = available.get(key) ?? [];
                ids.push(field.id);
                available.set(key, ids);
            }
            return {
                ...entry,
                fields: entry.fields.map((field) => {
                    const id = available.get(`${field.propertyType}|${field.property}`)?.shift();
                    return id ? { ...field, id } : field;
                })
            };
        })
    };
}
