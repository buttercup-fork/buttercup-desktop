// Stands in for Node's "util" in the window's bundle. The only user is path-posix,
// which calls util.isObject.
module.exports = {
    isObject: (value) => value !== null && typeof value === "object"
};
