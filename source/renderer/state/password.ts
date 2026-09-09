import { VaultSourceID } from "buttercup";
import { createStateObject } from "obstate";

export const PASSWORD_STATE = createStateObject<{
    passwordViaBiometricSource: VaultSourceID | null;
    promptSourceID: VaultSourceID | null;
    showPrompt: boolean;
}>({
    passwordViaBiometricSource: null,
    promptSourceID: null,
    showPrompt: false
});
