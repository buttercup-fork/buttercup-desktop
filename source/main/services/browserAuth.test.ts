import { jest } from "@jest/globals";
import { webcrypto } from "node:crypto";
import { EncryptionAlgorithm, createAdapter } from "iocane";

jest.unstable_mockModule("./config", () => ({
    getConfigValue: jest.fn(),
    setConfigValue: jest.fn()
}));

let browserAuth: typeof import("./browserAuth");
let symbols: typeof import("../symbols");

interface KeyPairStrings {
    privateKey: string;
    publicKey: string;
}

async function makeKeyPair(): Promise<KeyPairStrings> {
    const { privateKey, publicKey } = await webcrypto.subtle.generateKey(
        { name: symbols.API_KEY_ALGO, namedCurve: symbols.API_KEY_CURVE },
        true,
        ["deriveKey"]
    );
    return {
        privateKey: JSON.stringify(await webcrypto.subtle.exportKey("jwk", privateKey)),
        publicKey: JSON.stringify(await webcrypto.subtle.exportKey("jwk", publicKey))
    };
}

async function sharedSecret(privateKey: string, publicKey: string): Promise<string> {
    const algo = { name: symbols.API_KEY_ALGO, namedCurve: symbols.API_KEY_CURVE };
    const priv = await webcrypto.subtle.importKey("jwk", JSON.parse(privateKey), algo, true, [
        "deriveKey"
    ]);
    const pub = await webcrypto.subtle.importKey("jwk", JSON.parse(publicKey), algo, true, []);
    return browserAuth.deriveSecretKey(priv, pub);
}

let client: KeyPairStrings;
let desktop: KeyPairStrings;

beforeAll(async () => {
    browserAuth = await import("./browserAuth");
    symbols = await import("../symbols");
    client = await makeKeyPair();
    desktop = await makeKeyPair();
});

test("decrypts a GCM payload from a paired client", async () => {
    const payload = await browserAuth.encryptPayload(
        "hello desktop",
        client.privateKey,
        desktop.publicKey
    );
    expect(payload.split("$")[5]).toBe(EncryptionAlgorithm.GCM);
    await expect(
        browserAuth.decryptPayload(payload, client.publicKey, desktop.privateKey)
    ).resolves.toBe("hello desktop");
});

test("refuses a CBC payload, even one encrypted with the right key (B-759)", async () => {
    const secret = await sharedSecret(client.privateKey, desktop.publicKey);
    const payload = await createAdapter()
        .setAlgorithm(EncryptionAlgorithm.CBC)
        .setDerivationRounds(1000)
        .encrypt("hello desktop", secret);
    expect((payload as string).split("$")[5]).toBe(EncryptionAlgorithm.CBC);
    await expect(
        browserAuth.decryptPayload(payload as string, client.publicKey, desktop.privateKey)
    ).rejects.toThrow("not AES-GCM");
});

test("refuses a payload without a method field, which iocane would read as CBC (B-759)", async () => {
    const secret = await sharedSecret(client.privateKey, desktop.publicKey);
    const payload = (await createAdapter()
        .setAlgorithm(EncryptionAlgorithm.CBC)
        .setDerivationRounds(1000)
        .encrypt("hello desktop", secret)) as string;
    const withoutMethod = payload.split("$").slice(0, 5).join("$");
    await expect(
        browserAuth.decryptPayload(withoutMethod, client.publicKey, desktop.privateKey)
    ).rejects.toThrow("not AES-GCM");
});
