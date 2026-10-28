import { jest } from "@jest/globals";
import fs from "fs";
import os from "os";
import path from "path";

// B-682: CSV export holds every password unencrypted. The user is warned first,
// the file is owner-only, and a failed write is reported instead of thrown.

const sent: Array<[string, any]> = [];
const mainWindow = {
    webContents: { send: (channel: string, value: any) => sent.push([channel, value]) }
};
let confirmResponse = 0;
let savePath: string | undefined;
const mockShowMessageBox = jest.fn(async (..._args: Array<any>) => ({ response: confirmResponse }));
const mockShowSaveDialog = jest.fn(async (..._args: Array<any>) =>
    savePath ? { canceled: false, filePath: savePath } : { canceled: true }
);

jest.unstable_mockModule("electron", () => ({
    dialog: { showMessageBox: mockShowMessageBox, showSaveDialog: mockShowSaveDialog }
}));
jest.unstable_mockModule("./buttercup", () => ({
    exportVault: async () => "title,password\nBank,S3cret\n",
    getSourceDescription: () => ({ name: "Vault" })
}));
jest.unstable_mockModule("./windows", () => ({ getMainWindow: () => mainWindow }));
jest.unstable_mockModule("../library/log", () => ({ logErr: jest.fn(), logInfo: jest.fn() }));
jest.unstable_mockModule("../../shared/i18n/trans", () => ({
    t: (key: string) => key
}));

let exportVaultSource: typeof import("./export").exportVaultSource;
let dir: string;
const POSIX = process.platform !== "win32";

beforeAll(async () => {
    ({ exportVaultSource } = await import("./export"));
});

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bc-export-"));
    sent.length = 0;
    confirmResponse = 0;
    savePath = path.join(dir, "vault.csv");
    mockShowMessageBox.mockClear();
    mockShowSaveDialog.mockClear();
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

test("writes the CSV with a UTF-8 BOM and reports success (positive control)", async () => {
    await exportVaultSource("source-1");
    expect(fs.readFileSync(savePath, "utf8")).toBe("\uFEFFtitle,password\nBank,S3cret\n");
    expect(sent.map(([channel]) => channel)).toEqual(["notify-success"]);
});

test("warns that the file is unencrypted before the file is chosen", async () => {
    await exportVaultSource("source-1");
    expect(mockShowMessageBox).toHaveBeenCalledTimes(1);
    const options = mockShowMessageBox.mock.calls[0].find((arg: any) => arg && arg.message) as any;
    expect(options.message).toBe("dialog.export-warning.message");
    expect(mockShowMessageBox.mock.invocationCallOrder[0]).toBeLessThan(
        mockShowSaveDialog.mock.invocationCallOrder[0]
    );
});

test("cancelling the warning writes nothing and opens no file chooser", async () => {
    confirmResponse = 1;
    await exportVaultSource("source-1");
    expect(mockShowMessageBox).toHaveBeenCalledTimes(1);
    expect(mockShowSaveDialog).not.toHaveBeenCalled();
    expect(fs.readdirSync(dir)).toEqual([]);
});

(POSIX ? test : test.skip)("a new file is readable by its owner only (0600)", async () => {
    await exportVaultSource("source-1");
    expect(fs.statSync(savePath).mode & 0o777).toBe(0o600);
});

(POSIX ? test : test.skip)(
    "overwriting a world-readable file leaves it owner-only (0600)",
    async () => {
        fs.writeFileSync(savePath, "old", { mode: 0o644 });
        fs.chmodSync(savePath, 0o644);
        await exportVaultSource("source-1");
        expect(fs.statSync(savePath).mode & 0o777).toBe(0o600);
        expect(fs.readFileSync(savePath, "utf8")).toBe("\uFEFFtitle,password\nBank,S3cret\n");
    }
);

test("a write that fails is reported to the window, not thrown", async () => {
    savePath = path.join(dir, "no-such-folder", "vault.csv");
    await expect(exportVaultSource("source-1")).resolves.not.toThrow();
    expect(sent.map(([channel]) => channel)).toEqual(["notify-error"]);
    expect(sent[0][1]).toBe("notification.error.export-failed");
});
