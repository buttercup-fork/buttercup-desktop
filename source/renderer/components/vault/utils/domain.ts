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
 * The favicon URL for an entry's domain, fetched straight from the entry's own
 * site: no icon service, so no third party ever sees which sites a vault holds
 * logins for. Null for anything that isn't a plain host name.
 */
export function getFaviconURL(domain: string | null): string | null {
    return domain && HOSTNAME.test(domain) ? `https://${domain}/favicon.ico` : null;
}
