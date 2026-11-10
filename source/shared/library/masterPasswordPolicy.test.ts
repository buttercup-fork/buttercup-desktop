import { COMMON_PASSWORDS } from "./commonPasswords";
import {
    checkNewMasterPassword,
    MASTER_PASSWORD_MIN_LENGTH,
    masterPasswordLength
} from "./masterPasswordPolicy";

describe("checkNewMasterPassword", () => {
    test("refuses fewer than 8 characters (ASVS 6.2.1)", () => {
        expect(MASTER_PASSWORD_MIN_LENGTH).toBe(8);
        expect(checkNewMasterPassword("")).toBe("too-short");
        expect(checkNewMasterPassword("1")).toBe("too-short");
        expect(checkNewMasterPassword("Zq8#vLm")).toBe("too-short");
    });

    test("accepts 8 characters that are not a common password", () => {
        expect(checkNewMasterPassword("Zq8#vLm2")).toBeNull();
    });

    test("counts characters, not UTF-16 units", () => {
        // 4 emoji are 8 UTF-16 units but 4 characters
        expect(masterPasswordLength("😀😀😀😀")).toBe(4);
        expect(checkNewMasterPassword("😀😀😀😀")).toBe("too-short");
        expect(checkNewMasterPassword("😀🔑🌵🐙🎲🚲🍋🧭")).toBeNull();
    });

    test("refuses a common password whatever its case (ASVS 6.2.4)", () => {
        for (const pw of [
            "password",
            "Password",
            "PASSWORD",
            "12345678",
            "iloveyou",
            "1q2w3e4r",
            "qwertyuiop"
        ]) {
            expect(checkNewMasterPassword(pw)).toBe("common");
        }
    });

    test("sets no composition rules (ASVS 6.2.5)", () => {
        expect(checkNewMasterPassword("lowercase only words here")).toBeNull();
        expect(checkNewMasterPassword("95318642075")).toBeNull();
        expect(checkNewMasterPassword("        x       ")).toBeNull();
    });
});

describe("COMMON_PASSWORDS", () => {
    test("holds at least 3,000 lower-case entries of 8 or more characters, no repeats", () => {
        expect(COMMON_PASSWORDS.length).toBeGreaterThanOrEqual(3000);
        expect(new Set(COMMON_PASSWORDS).size).toBe(COMMON_PASSWORDS.length);
        for (const pw of COMMON_PASSWORDS) {
            expect(masterPasswordLength(pw)).toBeGreaterThanOrEqual(MASTER_PASSWORD_MIN_LENGTH);
            expect(pw).toBe(pw.toLowerCase());
        }
    });
});
