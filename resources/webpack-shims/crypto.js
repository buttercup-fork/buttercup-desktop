// Stands in for Node's "crypto" in the window's bundle. The only user is the
// password generator, which needs just `webcrypto`; the window has it as `crypto`.
module.exports = { webcrypto: globalThis.crypto };
