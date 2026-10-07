import { serialiseLogItems } from "./log";

describe("serialiseLogItems", () => {
    test("joins plain values", () => {
        expect(serialiseLogItems(["a", 1, true, { b: 2 }])).toBe('a 1 true {"b":2}');
    });

    test("writes an error with its stack by default", () => {
        const error = new Error("boom");
        expect(serialiseLogItems(["failed", error])).toBe(`failed ${error.stack}`);
    });

    test("uses the given error formatter", () => {
        expect(serialiseLogItems([new Error("boom")], (error) => `<${error.message}>`)).toBe(
            "<boom>"
        );
    });
});
