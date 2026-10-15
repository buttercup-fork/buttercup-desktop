import { NextFunction, Request, Response } from "express";

/** Names a request may use to reach this computer */
const ALLOWED_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

/** The only web origins that may talk to the API: browser extensions */
const ALLOWED_ORIGIN = /^(chrome-extension|moz-extension|safari-web-extension):\/\/[^/]+$/;

/** The API answers on this computer only, never on a network address */
export const LOOPBACK_ADDRESSES = ["127.0.0.1", "::1"];

/**
 * Check the origin a request says it comes from. No origin means the caller is
 * not a web page (a browser always sends one with a cross-origin request).
 */
export function isOriginAllowed(origin: string | undefined): boolean {
    return origin === undefined || ALLOWED_ORIGIN.test(origin);
}

/**
 * Check that a request is addressed to this computer by name, and that it
 * does not come from a web page. A web page (including one using DNS
 * rebinding) sends its own site as the Host or as the Origin.
 */
export function isRequestAllowed(headers: { host?: string; origin?: string }): boolean {
    const { host, origin } = headers;
    if (typeof host !== "string") {
        return false;
    }
    const hostname = host.replace(/:\d+$/, "").toLowerCase();
    if (!ALLOWED_HOSTNAMES.includes(hostname)) {
        return false;
    }
    return isOriginAllowed(origin);
}

/** Answer `403` before anything else runs when a request is not allowed */
export function requireLocalCaller(req: Request, res: Response, next: NextFunction): void {
    if (isRequestAllowed(req.headers)) {
        next();
        return;
    }
    res.status(403).set("Content-Type", "text/plain").send("Forbidden");
}
