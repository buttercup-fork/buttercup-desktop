import { jest } from "@jest/globals";
import {
    EntryType,
    Vault,
    VaultSource,
    VaultSourceStatus,
    consumeVaultFacade,
    createEntryFacade,
    createVaultFacade,
    getEntryURLs,
    init
} from "buttercup";

jest.unstable_mockModule("../library/log", () => ({
    log: jest.fn(),
    logErr: jest.fn(),
    logInfo: jest.fn(),
    logWarn: jest.fn()
}));

let search: typeof import("./search");

const SITE = "https://login.example.com/account";

function unlockedSource(vault: Vault): VaultSource {
    // VaultSourceEntrySearch reads only `id`, `status` and `vault`
    return { id: "source-1", status: VaultSourceStatus.Unlocked, vault } as unknown as VaultSource;
}

/** Save a new entry the way the app does: a facade from New Entry, merged into the vault */
function saveNewEntry(vault: Vault, type: EntryType, values: Record<string, string>): string {
    const entry = createEntryFacade(undefined, { type });
    entry.parentID = vault.findGroupsByTitle("General")[0].id;
    for (const [property, value] of Object.entries(values)) {
        const field = entry.fields.find(
            (f) => f.propertyType === "property" && f.property === property
        );
        if (!field) throw new Error(`A new ${type} entry has no "${property}" field`);
        field.value = value;
    }
    const facade = createVaultFacade(vault);
    facade.entries.push(entry);
    consumeVaultFacade(vault, facade, { mergeMode: true });
    return vault.findEntriesByProperty("title", values.title)[0].id;
}

beforeAll(async () => {
    init();
    search = await import("./search");
});

describe("searchAllVaultsByURL (the browser extension's lookup)", () => {
    it("finds a new Login by the address typed into its URL field (B-811)", async () => {
        const vault = Vault.createWithDefaults();
        const id = saveNewEntry(vault, EntryType.Login, {
            title: "Example",
            username: "user",
            password: "secret",
            url: SITE
        });
        await search.updateSearchCaches([unlockedSource(vault)]);
        const results = await search.searchAllVaultsByURL("https://login.example.com/");
        expect(results.map((r) => r.id)).toEqual([id]);
        expect(results[0].entryType).toBe(EntryType.Login);
        expect(getEntryURLs(results[0].properties)).toEqual([SITE]);
    });

    it("still finds a stored Website entry, which keeps its type", async () => {
        const vault = Vault.createWithDefaults();
        const id = saveNewEntry(vault, EntryType.Website, {
            title: "Old",
            username: "user",
            password: "secret",
            url: SITE
        });
        await search.updateSearchCaches([unlockedSource(vault)]);
        const results = await search.searchAllVaultsByURL("https://login.example.com/");
        expect(results.map((r) => r.id)).toEqual([id]);
        expect(results[0].entryType).toBe(EntryType.Website);
    });
});
