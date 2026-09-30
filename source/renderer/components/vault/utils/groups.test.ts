import { VaultFacade } from "buttercup";
import { countChildGroupsAndEntries } from "./groups";

// Trash > Old > Older, with entries at each level
const facade = {
    groups: [
        { id: "trash", parentID: "0", title: "Trash" },
        { id: "old", parentID: "trash", title: "Old" },
        { id: "older", parentID: "old", title: "Older" },
        { id: "general", parentID: "0", title: "General" },
        { id: "empty", parentID: "0", title: "Empty" }
    ],
    entries: [
        { id: "e1", parentID: "trash" },
        { id: "e2", parentID: "trash" },
        { id: "e3", parentID: "old" },
        { id: "e4", parentID: "older" },
        { id: "e5", parentID: "general" }
    ]
} as unknown as VaultFacade;

describe("countChildGroupsAndEntries", () => {
    test("counts entries directly in the group", () => {
        const onlyEntries = {
            ...facade,
            groups: facade.groups.slice(0, 1),
            entries: facade.entries.slice(0, 2)
        } as VaultFacade;
        expect(countChildGroupsAndEntries(onlyEntries, "trash")).toBe(2);
    });

    test("counts every subgroup and every entry below, once", () => {
        // 2 groups (Old, Older) + 4 entries (e1-e4)
        expect(countChildGroupsAndEntries(facade, "trash")).toBe(6);
    });

    test("is 0 for an empty group", () => {
        expect(countChildGroupsAndEntries(facade, "empty")).toBe(0);
    });
});
