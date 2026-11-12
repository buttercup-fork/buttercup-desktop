import { jest } from "@jest/globals";

// B-746: the cached facade is the decrypted vault; a locked vault's must
// never be served, whichever path locked it
const unlocked = new Set<string>();
let made = 0;
const mockGetVaultFacadeBySource = jest.fn((sourceID: string) => {
    if (!unlocked.has(sourceID)) {
        throw new Error(`Cannot generate facade: Source is not unlocked: ${sourceID}`);
    }
    made += 1;
    return { id: sourceID, made } as any;
});

jest.unstable_mockModule("./buttercup", () => ({
    getVaultFacadeBySource: mockGetVaultFacadeBySource,
    isSourceUnlocked: (sourceID: string) => unlocked.has(sourceID)
}));

let facades: typeof import("./facades");

beforeAll(async () => {
    facades = await import("./facades");
});

beforeEach(() => {
    unlocked.clear();
    made = 0;
    mockGetVaultFacadeBySource.mockClear();
    facades.clearFacadeCache("source-1");
});

describe("getVaultFacade", () => {
    it("serves the cached facade while the vault is unlocked", () => {
        unlocked.add("source-1");
        const first = facades.getVaultFacade("source-1");
        expect(facades.getVaultFacade("source-1")).toBe(first);
        expect(mockGetVaultFacadeBySource).toHaveBeenCalledTimes(1);
    });

    it("refuses a locked vault even with a cached facade", () => {
        unlocked.add("source-1");
        facades.getVaultFacade("source-1");
        // Locked without the cache being cleared (eg. source.lock() directly)
        unlocked.delete("source-1");
        expect(() => facades.getVaultFacade("source-1")).toThrow(/not unlocked/);
    });

    it("builds a new facade after a lock and unlock, not the one from before", () => {
        unlocked.add("source-1");
        const before = facades.getVaultFacade("source-1");
        unlocked.delete("source-1");
        expect(() => facades.getVaultFacade("source-1")).toThrow(/not unlocked/);
        unlocked.add("source-1");
        const after = facades.getVaultFacade("source-1");
        expect(after).not.toBe(before);
        expect(mockGetVaultFacadeBySource).toHaveBeenCalledTimes(2);
    });

    it("refuses source IDs that name object properties", () => {
        for (const sourceID of ["__proto__", "constructor", "toString"]) {
            expect(() => facades.getVaultFacade(sourceID)).toThrow(/not unlocked/);
        }
    });
});
