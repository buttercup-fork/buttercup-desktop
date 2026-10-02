import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { jest } from "@jest/globals";

let mockChosenPaths: Array<string> = [];

jest.unstable_mockModule("electron", () => ({
    dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: mockChosenPaths }) }
}));
jest.unstable_mockModule("./windows", () => ({ getMainWindow: () => null }));
jest.unstable_mockModule("../../shared/i18n/trans", () => ({ t: (key: string) => key }));
jest.unstable_mockModule("../library/log", () => ({ logInfo: jest.fn(), logWarn: jest.fn() }));

let chooseVaultFileForUpload: typeof import("./vaultFile").chooseVaultFileForUpload;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bcup-upload-"));

beforeAll(async () => {
    ({ chooseVaultFileForUpload } = await import("./vaultFile"));
});

afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

test("returns the name and contents of a vault file", async () => {
    const file = path.join(dir, "my vault.bcup");
    fs.writeFileSync(file, "b~>buttercup/bABCDEF");
    mockChosenPaths = [file];
    expect(await chooseVaultFileForUpload()).toEqual({
        contents: "b~>buttercup/bABCDEF",
        name: "my vault.bcup"
    });
});

test("refuses a file that isn't a vault", async () => {
    const file = path.join(dir, "notes.bcup");
    fs.writeFileSync(file, "just some text");
    mockChosenPaths = [file];
    expect(await chooseVaultFileForUpload()).toEqual({
        error: "dialog.vault-upload-chooser.not-a-vault"
    });
});

test("returns null when the dialog is cancelled", async () => {
    mockChosenPaths = [];
    expect(await chooseVaultFileForUpload()).toBeNull();
});
