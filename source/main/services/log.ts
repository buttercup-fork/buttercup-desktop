import fs from "fs";
import path from "path";
import rotate from "log-rotate";
import pify from "pify";
import { LOG_PATH } from "./storage";

const appendFile = pify(fs.appendFile);
const mkdir = pify(fs.mkdir);

const LOG_RETENTION = 10;

export function getLogPath(): string {
    // The portable app's log is in its data folder too (see storage)
    return LOG_PATH;
}

export async function initialise() {
    const logPath = getLogPath();
    await mkdir(path.dirname(logPath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
        rotate(logPath, { count: LOG_RETENTION, compress: false }, (error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

export async function writeLines(lines: Array<string>): Promise<void> {
    const logPath = getLogPath();
    await appendFile(logPath, `${lines.join("\n")}\n`);
}
