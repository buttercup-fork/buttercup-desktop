import type { IpcInvokeChannel, IpcReceiveChannel, IpcSendChannel } from "../../shared/ipcChannels";

type Listener = (event: object, ...args: Array<any>) => void;

interface ButtercupIPC {
    invoke(channel: IpcInvokeChannel, ...args: Array<unknown>): Promise<any>;
    on(channel: IpcReceiveChannel, listener: Listener): () => void;
    once(channel: IpcReceiveChannel, listener: Listener): void;
    send(channel: IpcSendChannel, ...args: Array<unknown>): void;
}

declare global {
    interface Window {
        buttercupIPC: ButtercupIPC;
    }
}

/**
 * The window's way to the main process: the bridge the preload script exposes
 * (source/preload), limited to the channels in source/shared/ipcChannels.ts
 */
export const ipcRenderer: ButtercupIPC = {
    invoke: (channel, ...args) => window.buttercupIPC.invoke(channel, ...args),
    on: (channel, listener) => window.buttercupIPC.on(channel, listener),
    once: (channel, listener) => window.buttercupIPC.once(channel, listener),
    send: (channel, ...args) => window.buttercupIPC.send(channel, ...args)
};
