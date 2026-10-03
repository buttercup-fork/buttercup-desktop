import { VaultSourceID } from "buttercup";
import { lockSourceAfterConfirming } from "./unsaved";
import { logInfo } from "../library/log";

/**
 * Lock a vault by hand. Asks first if it has unsaved changes.
 * @returns False if the user chose not to lock after all
 */
export async function lockSourceWithID(sourceID: VaultSourceID): Promise<boolean> {
    const locked = await lockSourceAfterConfirming(sourceID);
    if (locked) {
        logInfo(`Locked source: ${sourceID}`);
    }
    return locked;
}
