import { jest } from "@jest/globals";

const mockWriteText = jest.fn<(text: string) => void>();
const mockWriteConcealedText = jest.fn<(text: string) => boolean>();
const mockLogWarn = jest.fn();

jest.unstable_mockModule("electron", () => ({ clipboard: { writeText: mockWriteText } }));
jest.unstable_mockModule("@codekunde/conceal-clipboard", () => ({
    isSupported: () => true,
    writeConcealedText: mockWriteConcealedText
}));
jest.unstable_mockModule("../library/log", () => ({
    logErr: jest.fn(),
    logInfo: jest.fn(),
    logWarn: mockLogWarn
}));

let writeClipboardText: typeof import("./clipboardWrite").writeClipboardText;

beforeAll(async () => {
    ({ writeClipboardText } = await import("./clipboardWrite"));
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe("writeClipboardText", () => {
    it("uses the concealed copy when it works", () => {
        mockWriteConcealedText.mockReturnValue(true);
        writeClipboardText("s3cret");
        expect(mockWriteConcealedText).toHaveBeenCalledWith("s3cret");
        expect(mockWriteText).not.toHaveBeenCalled();
    });

    it("copies normally when concealing isn't supported or the clipboard was busy", () => {
        mockWriteConcealedText.mockReturnValue(false);
        writeClipboardText("s3cret");
        expect(mockWriteText).toHaveBeenCalledWith("s3cret");
    });

    it("copies normally when the native module throws", () => {
        mockWriteConcealedText.mockImplementation(() => {
            throw new Error("boom");
        });
        writeClipboardText("s3cret");
        expect(mockWriteText).toHaveBeenCalledWith("s3cret");
        expect(mockLogWarn).toHaveBeenCalled();
    });
});
