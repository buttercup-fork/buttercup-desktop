import { contextBridge, ipcRenderer } from "electron";
import {
    IPC_INVOKE_CHANNELS,
    IPC_RECEIVE_CHANNELS,
    IPC_SEND_CHANNELS
} from "../shared/ipcChannels";

// The window runs without Node access and with its own isolated world (B-475).
// This is its only way to the main process: the message channels the app uses
// (source/shared/ipcChannels.ts), nothing else of Electron's.
const invokeChannels: ReadonlySet<string> = new Set(IPC_INVOKE_CHANNELS);
const receiveChannels: ReadonlySet<string> = new Set(IPC_RECEIVE_CHANNELS);
const sendChannels: ReadonlySet<string> = new Set(IPC_SEND_CHANNELS);

function allow(channels: ReadonlySet<string>, channel: string, action: string): void {
    if (!channels.has(channel)) {
        throw new Error(`Blocked ${action} on unknown channel: ${channel}`);
    }
}

contextBridge.exposeInMainWorld("buttercupIPC", {
    invoke(channel: string, ...args: Array<unknown>): Promise<unknown> {
        allow(invokeChannels, channel, "invoke");
        return ipcRenderer.invoke(channel, ...args);
    },
    on(channel: string, listener: (event: object, ...args: Array<unknown>) => void): () => void {
        allow(receiveChannels, channel, "listen");
        // The event object stays on this side; listeners get an empty one
        const wrapped = (_event: unknown, ...args: Array<unknown>) => listener({}, ...args);
        ipcRenderer.on(channel, wrapped);
        return () => {
            ipcRenderer.removeListener(channel, wrapped);
        };
    },
    once(channel: string, listener: (event: object, ...args: Array<unknown>) => void): void {
        allow(receiveChannels, channel, "listen");
        ipcRenderer.once(channel, (_event, ...args) => listener({}, ...args));
    },
    send(channel: string, ...args: Array<unknown>): void {
        allow(sendChannels, channel, "send");
        ipcRenderer.send(channel, ...args);
    }
});
