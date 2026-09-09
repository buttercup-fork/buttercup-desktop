import fs from "fs";
import path from "path";
import { StorageInterface } from "buttercup";
import { ChannelQueue } from "@buttercup/channel-queue";
import pify from "pify";
import { naiveClone } from "../../shared/library/clone";
import { logErr, logWarn } from "./log";

const mkdir = pify(fs.mkdir);
const readFile = pify(fs.readFile);
const writeFile = pify(fs.writeFile);
const rename = pify(fs.rename);

export class FileStorage extends StorageInterface {
    _queue: ChannelQueue = null;
    _path: string;

    constructor(filePath: string) {
        super();
        this._path = filePath;
        this._queue = new ChannelQueue();
    }

    async getAllKeys(): Promise<Array<string>> {
        const data = await this._getContents();
        return Object.keys(data);
    }

    async getValue(name: string): Promise<any | null> {
        const data = await this._getContents();
        return typeof data[name] !== "undefined" ? data[name] : null;
    }

    async getValues(properties?: Array<string>): Promise<Record<string, unknown>> {
        const data = await this._getContents();
        if (!Array.isArray(properties)) {
            return { ...data };
        }
        const result = properties.reduce(
            (output, key) => ({
                ...output,
                [key]: data[key]
            }),
            {}
        );
        return naiveClone(result);
    }

    async removeKey(name: string): Promise<void> {
        return this._queue.channel("update").enqueue(async () => {
            const data = await this._getContents();
            delete data[name];
            await this._putContents(data);
        });
    }

    async setValue(name: string, value: any): Promise<void> {
        return this._queue.channel("update").enqueue(async () => {
            const data = await this._getContents();
            data[name] = value;
            await this._putContents(data);
        });
    }

    async setValues(values: Record<string, any>): Promise<void> {
        return this._queue.channel("update").enqueue(async () => {
            const data = await this._getContents();
            for (const key in values) {
                data[key] = values[key];
            }
            await this._putContents(data);
        });
    }

    async _getContents(): Promise<Object> {
        return this._queue.channel("io").enqueue(
            async () => {
                let data: Buffer;
                try {
                    data = await readFile(this._path);
                } catch (err) {
                    if (err.code === "ENOENT") {
                        // No file
                        return {};
                    }
                    // Other error
                    throw err;
                }
                try {
                    return JSON.parse(data.toString("utf8"));
                } catch (err) {
                    // The file exists but isn't valid JSON - typically an empty
                    // or truncated file left behind by a crash mid-write. Rather
                    // than re-throwing (which bricks the whole app on boot), move
                    // the bad file aside and start from an empty store.
                    logErr(`Corrupt storage file, resetting: ${this._path}`, err);
                    try {
                        await rename(this._path, `${this._path}.corrupt-${Date.now()}`);
                    } catch (renameErr) {
                        logWarn(`Failed to back up corrupt storage file: ${this._path}`, renameErr);
                    }
                    return {};
                }
            },
            undefined,
            "read"
        );
    }

    async _putContents(data: Object): Promise<void> {
        return this._queue.channel("io").enqueue(async () => {
            await mkdir(path.dirname(this._path), { recursive: true });
            // Write to a temp file and rename into place so a crash mid-write
            // can't leave a truncated (unparseable) file behind.
            const tempPath = `${this._path}.tmp-${process.pid}`;
            await writeFile(tempPath, JSON.stringify(data));
            await rename(tempPath, this._path);
        });
    }
}
