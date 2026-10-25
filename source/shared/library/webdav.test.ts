import { isInsecureWebDAVURL } from "./webdav";

describe("isInsecureWebDAVURL (B-684)", () => {
    test.each([
        "http://example.com/dav",
        "http://192.168.1.10/remote.php/dav",
        "http://nas.local:5005/dav",
        "HTTP://EXAMPLE.COM/dav",
        " http://example.com/dav ",
        "http://localhost.example.com/dav",
        "http://127.0.0.1.example.com/dav"
    ])("treats %s as insecure", (url) => {
        expect(isInsecureWebDAVURL(url)).toBe(true);
    });

    test.each([
        "https://example.com/dav",
        "http://localhost:9989/dav",
        "http://LOCALHOST/dav",
        "http://127.0.0.1:8080/dav",
        "http://127.1.2.3/dav",
        "http://[::1]:8080/dav",
        "",
        "not a url"
    ])("does not treat %s as insecure", (url) => {
        expect(isInsecureWebDAVURL(url)).toBe(false);
    });
});
