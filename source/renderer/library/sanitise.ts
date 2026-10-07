import createDOMPurify from "dompurify";

// Release notes come from the release page of the update feed. The renderer
// runs with Node integration, so markup from there must never reach it as-is:
// a script, handler or javascript: link would run with full system access.
// Only plain text formatting survives.
const ALLOWED_TAGS = [
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "li",
    "ol",
    "p",
    "pre",
    "strong",
    "ul"
];

type DOMWindow = Parameters<typeof createDOMPurify>[0];

export function createReleaseNotesSanitiser(win: DOMWindow): (html: string) => string {
    const purify = createDOMPurify(win);
    return (html: string) =>
        purify.sanitize(html ?? "", {
            ALLOWED_TAGS,
            ALLOWED_ATTR: ["href"],
            ALLOW_DATA_ATTR: false,
            // Links only go to the web or a mail client, like openExternalSafely
            ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i
        });
}

let sanitiser: ((html: string) => string) | null = null;

/**
 * Clean release-note HTML for display
 * @param html The HTML from the release
 * @returns Sanitised HTML containing only text formatting and http(s)/mailto links
 */
export function sanitiseReleaseNotes(html: string): string {
    if (!sanitiser) {
        sanitiser = createReleaseNotesSanitiser(window as unknown as DOMWindow);
    }
    return sanitiser(html);
}
