import { IncomingMessage, Server, ServerResponse } from "node:http";
import { Application } from "express";
import { BROWSER_API_HOST_PORT } from "../../symbols";
import { buildApplication } from "./api";
import { logInfo } from "../../library/log";
import { getConfigValue } from "../config";

let __app: Application | null = null,
    __server: Server<typeof IncomingMessage, typeof ServerResponse> | null = null;

export async function start(): Promise<void> {
    if (__server) return;
    const apiClients = await getConfigValue("browserClients");
    logInfo(`Starting browser API (${Object.keys(apiClients).length} keys registered)`);
    const app = buildApplication();
    await new Promise<void>((resolve, reject) => {
        const server = app.listen(BROWSER_API_HOST_PORT);
        server.once("error", (err: NodeJS.ErrnoException) => {
            // Without this handler a bind failure (e.g. EADDRINUSE when another
            // instance already holds the port) surfaces as an uncaught exception.
            server.removeAllListeners("listening");
            server.close();
            reject(err);
        });
        server.once("listening", () => {
            server.removeAllListeners("error");
            __app = app;
            __server = server;
            resolve();
        });
    });
}

export async function stop() {
    if (!__server) return;
    return new Promise<void>((resolve, reject) => {
        const server = __server;
        __server = null;
        __app = null;
        server.close((err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}
