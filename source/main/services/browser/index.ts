import { IncomingMessage, Server, ServerResponse } from "node:http";
import { Application } from "express";
import { BROWSER_API_HOST_PORT } from "../../symbols";
import { buildApplication } from "./api";
import { LOOPBACK_ADDRESSES } from "./network";
import { logInfo } from "../../library/log";
import { getConfigValue } from "../config";

type HTTPServer = Server<typeof IncomingMessage, typeof ServerResponse>;

let __app: Application | null = null,
    __server: HTTPServer | null = null,
    __otherServers: Array<HTTPServer> = [];

export async function start(): Promise<void> {
    if (__server) return;
    const apiClients = await getConfigValue("browserClients");
    logInfo(`Starting browser API (${Object.keys(apiClients).length} keys registered)`);
    const app = buildApplication();
    await new Promise<void>((resolve, reject) => {
        // Loopback only: the API must not be reachable from the network. The IPv4
        // server is the main one; the IPv6 one is best-effort, as IPv6 may be
        // switched off or its port taken.
        const [server, ...otherServers] = LOOPBACK_ADDRESSES.map((address) =>
            app.listen(BROWSER_API_HOST_PORT, address)
        );
        otherServers.forEach((other) => other.on("error", () => {}));
        server.once("error", (err: NodeJS.ErrnoException) => {
            // Without this handler a bind failure (e.g. EADDRINUSE when another
            // instance already holds the port) surfaces as an uncaught exception.
            server.removeAllListeners("listening");
            server.close();
            otherServers.forEach((other) => other.close());
            reject(err);
        });
        server.once("listening", () => {
            server.removeAllListeners("error");
            __app = app;
            __server = server;
            __otherServers = otherServers;
            resolve();
        });
    });
}

export async function stop() {
    if (!__server) return;
    return new Promise<void>((resolve, reject) => {
        const server = __server;
        const otherServers = __otherServers;
        __server = null;
        __otherServers = [];
        __app = null;
        otherServers.forEach((other) => other.close());
        server.close((err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}
