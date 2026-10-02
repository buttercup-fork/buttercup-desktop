import type { EventEmitter } from "events";

/**
 * Stop a closed stdout/stderr from crashing the app. Every log line is also
 * written to the console, and when whatever started the app goes away (the
 * terminal is closed, a launcher drops its end of the pipe), the next write
 * fails with EPIPE. With no "error" listener Node throws that as an uncaught
 * exception, over and over (#1330). The log file still gets every line.
 * @param streams The output streams to watch
 */
export function ignoreBrokenPipes(streams: Array<EventEmitter>): void {
    for (const stream of streams) {
        stream.on("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EPIPE") return;
            throw err;
        });
    }
}
