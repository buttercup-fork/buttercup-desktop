import { EventEmitter } from "events";
import { ignoreBrokenPipes } from "./stdio";

function errorWithCode(code: string): NodeJS.ErrnoException {
    return Object.assign(new Error(`write ${code}`), { code });
}

test("ignores EPIPE on a closed output stream", () => {
    const stdout = new EventEmitter();
    ignoreBrokenPipes([stdout]);
    expect(() => stdout.emit("error", errorWithCode("EPIPE"))).not.toThrow();
});

test("still throws other stream errors", () => {
    const stderr = new EventEmitter();
    ignoreBrokenPipes([stderr]);
    expect(() => stderr.emit("error", errorWithCode("EIO"))).toThrow("write EIO");
});
