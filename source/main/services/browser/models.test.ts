import { jest } from "@jest/globals";
import { EntryType } from "buttercup";
import { ZodError } from "zod";

jest.unstable_mockModule("../../library/log", () => ({
    log: jest.fn(),
    logErr: jest.fn(),
    logInfo: jest.fn(),
    logWarn: jest.fn()
}));

let models: typeof import("./models");
let handleError: typeof import("./error").handleError;

beforeAll(async () => {
    models = await import("./models");
    ({ handleError } = await import("./error"));
});

const ULID = "01jc000000000000000000b728";

// What the Browser API accepts and refuses (B-728: zod 3 -> 4 must not change it)
describe("Browser API models", () => {
    test("pairing request and response", () => {
        const request = { client: "browser", purpose: "vaults-access", rev: 1 };
        expect(models.AuthRequestSchema.parse(request)).toEqual(request);
        expect(() => models.AuthRequestSchema.parse({ ...request, rev: 2 })).toThrow(ZodError);
        const response = { code: "ABCDEFGHJKLM", id: ULID, publicKey: "{}" };
        expect(models.AuthResponseSchema.parse(response)).toEqual(response);
        expect(() => models.AuthResponseSchema.parse({ ...response, id: "short" })).toThrow(
            ZodError
        );
        expect(() => models.AuthResponseSchema.parse({ ...response, code: "" })).toThrow(ZodError);
    });

    test("search by term or by URL", () => {
        expect(models.EntriesSearchQuerySchema.parse({ type: "term", term: "bank" })).toEqual({
            type: "term",
            term: "bank"
        });
        expect(
            models.EntriesSearchQuerySchema.parse({
                type: "url",
                url: "https://login.example.com/a?b=c"
            })
        ).toEqual({ type: "url", url: "https://login.example.com/a?b=c" });
        expect(() =>
            models.EntriesSearchQuerySchema.parse({ type: "url", url: "not a url" })
        ).toThrow(ZodError);
        expect(() => models.EntriesSearchQuerySchema.parse({ type: "url" })).toThrow(ZodError);
        expect(() => models.EntriesSearchQuerySchema.parse({ type: "other", term: "x" })).toThrow(
            ZodError
        );
    });

    test("search for specific entries", () => {
        const body = { entries: [{ entryID: "e1", sourceID: "s1" }] };
        expect(models.EntriesSearchBodySchema.parse(body)).toEqual(body);
        expect(() =>
            models.EntriesSearchBodySchema.parse({ entries: [{ entryID: "", sourceID: "s1" }] })
        ).toThrow(ZodError);
        expect(() => models.EntriesSearchBodySchema.parse({ entries: "e1" })).toThrow(ZodError);
    });

    test("new entry: any entry type, string properties only", () => {
        const properties = {
            title: "Shop",
            username: "u",
            password: "p",
            url: "https://shop.example.com"
        };
        for (const type of Object.values(EntryType)) {
            expect(models.SaveNewEntryPayloadSchema.parse({ properties, type })).toEqual({
                properties,
                type
            });
        }
        expect(() =>
            models.SaveNewEntryPayloadSchema.parse({ properties, type: "unknown" })
        ).toThrow(ZodError);
        expect(() =>
            models.SaveNewEntryPayloadSchema.parse({
                properties: { title: 1 },
                type: EntryType.Login
            })
        ).toThrow(ZodError);
        expect(() => models.SaveNewEntryPayloadSchema.parse({ type: EntryType.Login })).toThrow(
            ZodError
        );
    });

    test("existing entry: string properties only", () => {
        expect(
            models.SaveExistingEntryPayloadSchema.parse({ properties: { password: "p" } })
        ).toEqual({
            properties: { password: "p" }
        });
        expect(() =>
            models.SaveExistingEntryPayloadSchema.parse({ properties: { password: ["p"] } })
        ).toThrow(ZodError);
    });

    test("route parameters refuse unknown keys", () => {
        expect(models.SaveNewEntryParamSchema.parse({ gid: "g", id: "s" })).toEqual({
            gid: "g",
            id: "s"
        });
        expect(() => models.SaveNewEntryParamSchema.parse({ gid: "g", id: "s", x: "1" })).toThrow(
            ZodError
        );
        expect(() =>
            models.SaveExistingEntryParamSchema.parse({ eid: "e", gid: "g", id: "s", x: "1" })
        ).toThrow(ZodError);
        expect(() => models.VaultUnlockParamSchema.parse({ id: "" })).toThrow(ZodError);
    });
});

describe("handleError", () => {
    function fakeResponse() {
        const res: any = {
            statusCode: 0,
            body: undefined as unknown,
            headers: {} as Record<string, string>
        };
        res.status = (code: number) => ((res.statusCode = code), res);
        res.set = (name: string, value: string) => ((res.headers[name] = value), res);
        res.send = (body: unknown) => ((res.body = body), res);
        return res;
    }

    test("answers 400 to a request that fails validation", () => {
        let error: unknown;
        try {
            models.SaveNewEntryPayloadSchema.parse({ properties: {}, type: "unknown" });
        } catch (err) {
            error = err;
        }
        expect(error).toBeInstanceOf(ZodError);
        const res = fakeResponse();
        handleError(error as Error, { url: "/v1/test" } as any, res, () => {});
        expect(res.statusCode).toBe(400);
        expect(res.body).toBe("Bad Request");
    });
});
