// Loads the native module; if it's missing or fails to load, every call reports
// "not supported" so the app falls back to a normal clipboard copy.
let native = null;
try {
    native = require("./build/Release/conceal_clipboard.node");
} catch (err) {
    native = null;
}

module.exports = {
    isSupported: () => !!native && native.isSupported(),
    writeConcealedText: text => (native ? native.writeConcealedText(text) : false)
};
