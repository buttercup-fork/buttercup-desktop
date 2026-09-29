import http from "node:http";
import type { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";

// Google's recommended redirect for desktop apps: a short-lived HTTP listener on
// the loopback interface. Google sends the browser to
// http://127.0.0.1:<port>/?state=...&code=..., so the auth code reaches the app
// directly instead of relying on a website to bounce it back via buttercup://.

export interface LoopbackAuthSession {
    close: () => void;
    redirectURI: string;
    state: string;
    waitForCode: () => Promise<string>;
}

const RESPONSE_DONE = `<!doctype html><html><head><meta charset="utf-8"><title>Buttercup</title></head>
<body style="font-family:sans-serif;text-align:center;padding-top:4em">
<h2>Signed in</h2><p>You can close this tab and return to Buttercup.</p></body></html>`;

const RESPONSE_FAILED = `<!doctype html><html><head><meta charset="utf-8"><title>Buttercup</title></head>
<body style="font-family:sans-serif;text-align:center;padding-top:4em">
<h2>Sign-in failed</h2><p>Return to Buttercup and try again.</p></body></html>`;

export async function startLoopbackAuth(timeoutMs: number): Promise<LoopbackAuthSession> {
    const state = randomBytes(16).toString("hex");
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    let resolveCode: (code: string) => void;
    let rejectCode: (err: Error) => void;
    const codePromise = new Promise<string>((resolve, reject) => {
        resolveCode = resolve;
        rejectCode = reject;
    });
    // Nobody may be awaiting yet (e.g. close() before waitForCode()).
    codePromise.catch(() => {});

    const server = http.createServer((req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        if (req.method !== "GET" || url.pathname !== "/") {
            res.writeHead(404).end();
            return;
        }
        const params = url.searchParams;
        // Ignore stray requests that don't carry our state, so another local page
        // can't end the session or inject a code.
        if (params.get("state") !== state) {
            res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" }).end(RESPONSE_FAILED);
            return;
        }
        const code = params.get("code");
        const error = params.get("error");
        res.writeHead(code ? 200 : 400, { "Content-Type": "text/html; charset=utf-8" }).end(
            code ? RESPONSE_DONE : RESPONSE_FAILED
        );
        if (code) {
            finish(null, code);
        } else {
            finish(new Error(`Google authentication failed: ${error || "no code returned"}`));
        }
    });

    const finish = (err: Error | null, code?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        server.close();
        server.closeAllConnections();
        if (err) rejectCode(err);
        else resolveCode(code);
    };

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => resolve());
    });
    const { port } = server.address() as AddressInfo;
    timeout = setTimeout(
        () => finish(new Error("Timed-out waiting for Google authentication")),
        timeoutMs
    );

    return {
        close: () => finish(new Error("Google authentication cancelled")),
        redirectURI: `http://127.0.0.1:${port}`,
        state,
        waitForCode: () => codePromise
    };
}
