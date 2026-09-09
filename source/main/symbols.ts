export const API_KEY_ALGO = "ECDH";
export const API_KEY_CURVE = "P-256";
export const BROWSER_API_HOST_PORT = 12822;
export const BUTTERCUP_PROTOCOL = "codekunde-buttercup://";
// The Google OAuth redirect page (buttercup.pw) still bounces to the original
// `buttercup://` scheme, so we accept it for inbound auth callbacks. It's listed
// after the primary scheme so the primary one wins where order matters.
export const LEGACY_BUTTERCUP_PROTOCOL = "buttercup://";
export const ACCEPTED_PROTOCOLS = [BUTTERCUP_PROTOCOL, LEGACY_BUTTERCUP_PROTOCOL];
export const PLATFORM_MACOS = "darwin";
export const SECURE_FILE_HOST_PORT = 12821;
