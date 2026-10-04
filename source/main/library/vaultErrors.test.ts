import { isDamagedVaultError } from "./vaultErrors";

test("recognises a vault cut off before its salt", () => {
    expect(
        isDamagedVaultError(
            new Error("Failed unlocking source: Failed deriving key: Salt must be provided")
        )
    ).toBe(true);
});

test("recognises an empty file and a file that isn't a vault", () => {
    expect(
        isDamagedVaultError(
            new Error("Failed unlocking source: Failed to load vault: Content is empty")
        )
    ).toBe(true);
    expect(
        isDamagedVaultError(new Error("Failed unlocking source: No valid signature in vault"))
    ).toBe(true);
});

test("doesn't mistake a wrong password for damage", () => {
    expect(
        isDamagedVaultError(
            new Error(
                "Failed unlocking source: Failed decrypting vault: Unsupported state or unable to authenticate data"
            )
        )
    ).toBe(false);
    expect(
        isDamagedVaultError(
            new Error("Failed decrypting vault: Authentication failed while decrypting content")
        )
    ).toBe(false);
});

test("copes with non-Error values", () => {
    expect(isDamagedVaultError("No valid signature in vault")).toBe(true);
    expect(isDamagedVaultError(undefined)).toBe(false);
});
