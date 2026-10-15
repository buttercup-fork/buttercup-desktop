import { jest } from "@jest/globals";

const sent: Array<[channel: string, payload?: string]> = [];
const fakeWindow = {
    webContents: {
        send: (channel: string, payload?: string) => {
            sent.push([channel, payload]);
        }
    }
};

jest.unstable_mockModule("../windows", () => ({
    getMainWindow: () => fakeWindow,
    openMainWindow: async () => fakeWindow
}));

let CODE_CHARS: string;
let CODE_LENGTH: number;
let promptUserForBrowserAccess: typeof import("./interaction").promptUserForBrowserAccess;
let validateEnteredCode: typeof import("./interaction").validateEnteredCode;

beforeAll(async () => {
    ({ CODE_CHARS, CODE_LENGTH, promptUserForBrowserAccess, validateEnteredCode } =
        await import("./interaction"));
});

beforeEach(() => {
    sent.length = 0;
});

function shownCode(): string {
    const entry = [...sent].reverse().find(([channel]) => channel === "browser-access-code");
    return JSON.parse(entry?.[1] ?? "{}").code;
}

describe("pairing code", () => {
    test("has no repeated characters in its alphabet", () => {
        expect(new Set(CODE_CHARS).size).toBe(CODE_CHARS.length);
    });

    test("is 12 characters from the alphabet", async () => {
        for (let i = 0; i < 100; i += 1) {
            await promptUserForBrowserAccess();
            const code = shownCode();
            expect(code).toHaveLength(CODE_LENGTH);
            for (const char of code) {
                expect(CODE_CHARS).toContain(char);
            }
        }
    });

    test("is not made with Math.random", async () => {
        const before = Math.random;
        Math.random = () => {
            throw new Error("Math.random must not be used for the pairing code");
        };
        try {
            await promptUserForBrowserAccess();
            expect(shownCode()).toHaveLength(CODE_LENGTH);
        } finally {
            Math.random = before;
        }
    });

    test("differs between prompts", async () => {
        const codes = new Set<string>();
        for (let i = 0; i < 50; i += 1) {
            await promptUserForBrowserAccess();
            codes.add(shownCode());
        }
        expect(codes.size).toBe(50);
    });
});

describe("validateEnteredCode", () => {
    test("accepts the shown code once", async () => {
        await promptUserForBrowserAccess();
        const code = shownCode();
        expect(await validateEnteredCode(code)).toBe(true);
        expect(await validateEnteredCode(code)).toBe(false);
    });

    test("refuses a wrong code, and then the right one (one try per code)", async () => {
        await promptUserForBrowserAccess();
        const code = shownCode();
        expect(await validateEnteredCode("A".repeat(CODE_LENGTH))).toBe(false);
        expect(await validateEnteredCode(code)).toBe(false);
    });

    test("refuses a code of another length without throwing", async () => {
        await promptUserForBrowserAccess();
        const code = shownCode();
        expect(await validateEnteredCode(code.slice(0, -1))).toBe(false);
    });

    test("refuses any code when none was asked for", async () => {
        await promptUserForBrowserAccess();
        const code = shownCode();
        await validateEnteredCode(code);
        expect(await validateEnteredCode(code)).toBe(false);
        expect(await validateEnteredCode("")).toBe(false);
    });

    test("tells the window to hide the code after an attempt", async () => {
        await promptUserForBrowserAccess();
        sent.length = 0;
        await validateEnteredCode("nope");
        expect(sent.some(([channel]) => channel === "browser-access-code-hide")).toBe(true);
    });
});
