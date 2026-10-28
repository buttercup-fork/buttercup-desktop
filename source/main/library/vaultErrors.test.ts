import { Layerr } from "layerr";
import { isDamagedVaultError, isInsecureEndpointError, isWrongPasswordError } from "./vaultErrors";

describe("isWrongPasswordError (B-117)", () => {
    // What core (from 3b25f2d) throws: the stored credentials fail to decrypt
    // with the master password, and VaultSource.unlock wraps that
    const authFailure = new Error("Unsupported state or unable to authenticate data");
    const credentialsFailure = new Layerr(
        { cause: authFailure, info: { code: "DECRYPTION_FAILED" } },
        "Failed decrypting credentials"
    );

    test("recognises a wrong master password, also when wrapped by unlock", () => {
        expect(isWrongPasswordError(credentialsFailure)).toBe(true);
        expect(
            isWrongPasswordError(new Layerr(credentialsFailure, "Failed unlocking source"))
        ).toBe(true);
    });

    test("does not call a damaged or tampered vault file a wrong password", () => {
        // The credentials opened (right password) but the file did not
        const fileFailure = new Layerr(
            { cause: authFailure, info: { code: "DECRYPTION_FAILED" } },
            "Failed decrypting vault"
        );
        expect(isWrongPasswordError(new Layerr(fileFailure, "Failed unlocking source"))).toBe(
            false
        );
    });

    test("does not guess from an untagged error (core before the B-117 change)", () => {
        expect(
            isWrongPasswordError(
                new Error(
                    "Failed unlocking source: Unsupported state or unable to authenticate data"
                )
            )
        ).toBe(false);
        expect(
            isWrongPasswordError(
                new Layerr({ info: { code: "INSECURE_ENDPOINT" } }, "Failed decrypting credentials")
            )
        ).toBe(false);
        expect(isWrongPasswordError(null)).toBe(false);
    });
});

describe("isInsecureEndpointError (B-684)", () => {
    test("recognises core's refusal, also when wrapped by unlock", () => {
        const refused = new Layerr(
            { info: { code: "INSECURE_ENDPOINT" } },
            "WebDAV endpoint uses unencrypted http"
        );
        expect(isInsecureEndpointError(refused)).toBe(true);
        expect(isInsecureEndpointError(new Layerr(refused, "Failed unlocking source"))).toBe(true);
    });

    test("ignores other errors", () => {
        expect(
            isInsecureEndpointError(new Layerr({ info: { code: "DECRYPTION_FAILED" } }, "x"))
        ).toBe(false);
        expect(isInsecureEndpointError(new Error("Failed unlocking source"))).toBe(false);
        expect(isInsecureEndpointError(null)).toBe(false);
    });
});

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

test("recognises a vault cut off, as core's own crypto words it", () => {
    expect(
        isDamagedVaultError(
            new Error(
                "Failed unlocking source: Decoding error: Encrypted content corrupt or incomplete"
            )
        )
    ).toBe(true);
    expect(
        isDamagedVaultError(
            new Error(
                "Failed unlocking source: Decoding error: Encrypted content length is corrupt"
            )
        )
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
