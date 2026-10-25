import { getErrorCode } from "buttercup";

// Errors that only a damaged vault produces: the file is empty, isn't a vault,
// or was cut off before the key salt (#1233). A wrong password gives other
// errors, and so does a vault cut off near its very end, which can't be told
// apart from a wrong password.
const DAMAGED_VAULT_ERRORS = [
    "Failed deriving key: Salt must be provided",
    "Failed to load vault: Content is empty",
    "No valid signature in vault",
    // What core's own crypto says for a file cut off before the encrypted content ends
    "Decoding error: Encrypted content corrupt or incomplete",
    "Decoding error: Encrypted content length is corrupt"
];

/**
 * Whether an unlock error means the vault file itself is damaged (#1233)
 */
export function isDamagedVaultError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return DAMAGED_VAULT_ERRORS.some((damaged) => message.includes(damaged));
}

// ErrorCode.InsecureEndpoint from core 8 (B-684); a string until desktop's
// core lock has the enum member
const INSECURE_ENDPOINT = "INSECURE_ENDPOINT";

/**
 * Whether an unlock error means core refused a WebDAV address on plain http
 * (B-684)
 */
export function isInsecureEndpointError(err: unknown): boolean {
    const code: string | null = getErrorCode(err as Error);
    return code === INSECURE_ENDPOINT;
}
