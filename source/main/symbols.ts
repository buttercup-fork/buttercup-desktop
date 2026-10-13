export const API_KEY_ALGO = "ECDH";
export const API_KEY_CURVE = "P-256";
export const BROWSER_API_HOST_PORT = 12822;
export const BUTTERCUP_PROTOCOL = "codekunde-buttercup://";
// The original project's Google OAuth redirect page bounced to the `buttercup://`
// scheme, so it is still accepted for inbound auth callbacks. It is listed after
// the primary scheme so the primary one wins where order matters.
export const LEGACY_BUTTERCUP_PROTOCOL = "buttercup://";
export const ACCEPTED_PROTOCOLS = [BUTTERCUP_PROTOCOL, LEGACY_BUTTERCUP_PROTOCOL];
export const PLATFORM_MACOS = "darwin";
export const SECURE_FILE_HOST_PORT = 12821;
