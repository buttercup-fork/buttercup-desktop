import { COMMON_PASSWORDS } from "./commonPasswords";

// Rules for a master password that is being set (new vault, password change),
// never for unlocking an existing vault (B-758, desktop D-057, ASVS v5.0.0-6.2.1,
// 6.2.4 and 6.2.5: a length floor and a common-password list, no composition rules)
export const MASTER_PASSWORD_MIN_LENGTH = 8;
export const MASTER_PASSWORD_RECOMMENDED_LENGTH = 15;

export type MasterPasswordProblem = "too-short" | "common";

let __common: Set<string> | null = null;

function isCommonPassword(password: string): boolean {
    if (!__common) {
        __common = new Set(COMMON_PASSWORDS);
    }
    // Lower-case for the lookup only: the password itself is used exactly as typed (6.2.8)
    return __common.has(password.toLowerCase());
}

/**
 * Length in characters (code points), so an emoji or a CJK character counts once
 * @param password The password as typed
 */
export function masterPasswordLength(password: string): number {
    return Array.from(password).length;
}

/**
 * Why a new master password is refused, or null when it may be used
 * @param password The new password as typed
 */
export function checkNewMasterPassword(password: string): MasterPasswordProblem | null {
    if (masterPasswordLength(password) < MASTER_PASSWORD_MIN_LENGTH) return "too-short";
    if (isCommonPassword(password)) return "common";
    return null;
}
