import { logWarn } from "../library/log";
import { ACCEPTED_PROTOCOLS } from "../symbols";

/**
 * Return the value if it starts with one of the schemes we handle, else null.
 */
export function matchProtocolURL(value: string): string | null {
    if (typeof value !== "string") return null;
    return ACCEPTED_PROTOCOLS.some((scheme) => value.startsWith(scheme)) ? value : null;
}

export function handleProtocolCall(protocolURL: string) {
    const scheme = ACCEPTED_PROTOCOLS.find((s) => protocolURL.startsWith(s));
    if (!scheme) {
        logWarn(`Ignoring unrecognised protocol URL: ${protocolURL}`);
        return;
    }
    // No actions are handled at the moment: Google sign-in used to come back as
    // buttercup://auth/google/..., but now uses a loopback redirect instead
    // (see library/googleLoopback.ts). Only the action is logged, since the rest
    // of the URL may carry credentials.
    const [action] = protocolURL.slice(scheme.length).split(/[/?]/);
    logWarn(`Unhandled protocol URL action: ${action}`);
}
