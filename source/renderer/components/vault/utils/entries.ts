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
