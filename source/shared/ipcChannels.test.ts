import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { IPC_INVOKE_CHANNELS, IPC_RECEIVE_CHANNELS, IPC_SEND_CHANNELS } from "./ipcChannels";

const RENDERER_DIR = path.resolve(process.cwd(), "source/renderer");

function sourceFiles(dir: string): Array<string> {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return sourceFiles(full);
        return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });
}

function usedChannels(method: string): Array<string> {
    const pattern = new RegExp(String.raw`ipcRenderer\s*\.${method}\(\s*"([^"]+)"`, "g");
    const channels = new Set<string>();
    for (const file of sourceFiles(RENDERER_DIR)) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(pattern)) channels.add(match[1]);
    }
    return [...channels].sort();
}

// The window's preload script only passes these channels (B-475), so a channel the
// window uses but the list lacks would fail at run time, and one it no longer uses
// would stay open for nothing.
describe("IPC channel lists", () => {
    test("invoke channels match what the window invokes", () => {
        expect([...IPC_INVOKE_CHANNELS]).toEqual(usedChannels("invoke"));
    });

    test("send channels match what the window sends", () => {
        expect([...IPC_SEND_CHANNELS]).toEqual(usedChannels("send"));
    });

    test("receive channels match what the window listens for", () => {
        const listened = [...new Set([...usedChannels("on"), ...usedChannels("once")])].sort();
        expect([...IPC_RECEIVE_CHANNELS]).toEqual(listened);
    });

    test("no channel is in the lists twice", () => {
        for (const list of [IPC_INVOKE_CHANNELS, IPC_SEND_CHANNELS, IPC_RECEIVE_CHANNELS]) {
            expect(new Set(list).size).toBe(list.length);
        }
    });
});
