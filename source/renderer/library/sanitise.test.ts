import { JSDOM } from "jsdom";
import { createReleaseNotesSanitiser } from "./sanitise";

const sanitise = createReleaseNotesSanitiser(new JSDOM("").window as any);

describe("createReleaseNotesSanitiser", () => {
    test("keeps text formatting and links", () => {
        const html =
            '<h2>Fixes</h2><ul><li>One <strong>bold</strong></li></ul><p><a href="https://example.com/x">link</a></p>';
        expect(sanitise(html)).toBe(html);
    });

    test("removes script tags", () => {
        expect(sanitise("<p>hi</p><script>require('child_process')</script>")).toBe("<p>hi</p>");
    });

    test("removes event handlers and other attributes", () => {
        expect(sanitise('<p onclick="x()" style="color:red" id="a">hi</p>')).toBe("<p>hi</p>");
        expect(sanitise('<img src="x" onerror="x()">')).toBe("");
    });

    test("removes links that are not http, https or mailto", () => {
        expect(sanitise('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
        expect(sanitise('<a href="file:///c:/windows/system32/calc.exe">x</a>')).toBe("<a>x</a>");
        expect(sanitise('<a href="mailto:a@b.c">x</a>')).toBe('<a href="mailto:a@b.c">x</a>');
    });

    test("removes forms, frames and embeds", () => {
        expect(sanitise('<iframe src="https://example.com"></iframe>')).toBe("");
        expect(sanitise('<form action="x"><input name="p"></form>text')).toBe("text");
        expect(sanitise('<object data="x"></object><embed src="x">')).toBe("");
    });

    test("handles empty and missing input", () => {
        expect(sanitise("")).toBe("");
        expect(sanitise(undefined as any)).toBe("");
    });
});
