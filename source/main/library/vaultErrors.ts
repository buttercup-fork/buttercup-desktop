// Errors that only a damaged vault produces: the file is empty, isn't a vault,
// or was cut off before the key salt (#1233). A wrong password gives other
// errors, and so does a vault cut off near its very end, which can't be told
// apart from a wrong password.
const DAMAGED_VAULT_ERRORS = [
    "Failed deriving key: Salt must be provided",
    "Failed to load vault: Content is empty",
    "No valid signature in vault"
];

/**
 * Whether an unlock error means the vault file itself is damaged (#1233)
 */
export function isDamagedVaultError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return DAMAGED_VAULT_ERRORS.some((damaged) => message.includes(damaged));
}
