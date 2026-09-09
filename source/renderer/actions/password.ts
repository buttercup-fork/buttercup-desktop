import { VaultSourceID } from "buttercup";
import { getPasswordEmitter } from "../services/password";
import { sourceHasBiometricAvailability } from "../services/biometrics";
import { PASSWORD_STATE } from "../state/password";

export async function getPrimaryPassword(
    sourceID?: VaultSourceID
): Promise<[password: string | null, biometricsEnabled: boolean, usedBiometrics: boolean]> {
    let biometricsEnabled: boolean = false;
    // The prompt reads the vault being unlocked from here rather than from
    // `VAULTS_STATE.currentVault`, which isn't set when unlocking is triggered
    // from the tray or app menu (buttercup/buttercup-desktop#1280) - the prompt
    // would then render blank.
    PASSWORD_STATE.promptSourceID = sourceID ?? null;
    if (sourceID) {
        const supportsBiometrics = await sourceHasBiometricAvailability(sourceID);
        if (supportsBiometrics) {
            PASSWORD_STATE.passwordViaBiometricSource = sourceID;
            biometricsEnabled = true;
        }
    }
    PASSWORD_STATE.showPrompt = true;
    const emitter = getPasswordEmitter();
    const [password, usedBiometrics] = await new Promise<[string | null, boolean]>((resolve) => {
        const callback = (password: string | null, usedBiometrics: boolean) => {
            resolve([password, usedBiometrics]);
            emitter.removeListener("password", callback);
        };
        emitter.once("password", callback);
    });
    PASSWORD_STATE.passwordViaBiometricSource = null;
    PASSWORD_STATE.promptSourceID = null;
    return [password, biometricsEnabled, usedBiometrics];
}
