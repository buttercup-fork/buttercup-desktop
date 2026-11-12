import { VaultFacade, VaultSourceID } from "buttercup";
import { getVaultFacadeBySource, isSourceUnlocked } from "./buttercup";

const __cachedFacades = new Map<VaultSourceID, VaultFacade>();

export function cacheFacade(sourceID: VaultSourceID, vaultFacade: VaultFacade): void {
    __cachedFacades.set(sourceID, vaultFacade);
}

export function clearFacadeCache(sourceID: VaultSourceID): void {
    __cachedFacades.delete(sourceID);
}

export function getVaultFacade(sourceID: VaultSourceID): VaultFacade {
    // A vault can be locked from several places (lock, auto-lock, a damaged
    // vault's restore), so the cached facade (the decrypted vault) is never
    // served without checking: a locked vault's is dropped (B-746)
    if (!isSourceUnlocked(sourceID)) {
        clearFacadeCache(sourceID);
        throw new Error(`Cannot get facade: Source is not unlocked: ${sourceID}`);
    }
    let facade = __cachedFacades.get(sourceID);
    if (!facade) {
        facade = getVaultFacadeBySource(sourceID);
        cacheFacade(sourceID, facade);
    }
    return facade;
}
