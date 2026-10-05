const HOSTNAME = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/i;

/**
 * Get the host name from a URL, without port or path. URLs saved without a
 * scheme ("example.com/login") work too.
 */
export function extractDomain(str: string): string {
    const withoutScheme = str.trim().replace(/^https?:\/\//i, "");
    const [hostAndPort] = withoutScheme.split(/[/?#]/);
    const [domain] = hostAndPort.split(":");
    return domain;
}

/**
 * Whether a domain is a plain host name the main process can look up an icon
 * for (#1071). The icon comes from the entry's own site, never an icon service,
 * so no third party sees which sites a vault holds logins for.
 */
export function isIconDomain(domain: string | null): boolean {
    return !!domain && HOSTNAME.test(domain);
}
