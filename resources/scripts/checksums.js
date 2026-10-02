/**
 * Writes SHA256SUMS.txt for the release installers (#1193), in the format
 * `sha256sum -c` reads:
 *
 *   node ./resources/scripts/checksums.js <output dir> <dir with installers>...
 *
 * Installers are looked for (non-recursively) in each input directory;
 * update metadata (latest*.yml, *.blockmap) is left out.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const INSTALLER = /\.(exe|dmg|zip|AppImage|deb|7z)$/;

function sha256(file) {
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const [outDir, ...inputDirs] = process.argv.slice(2);
if (!outDir || inputDirs.length === 0) {
    console.error("Usage: checksums.js <output dir> <dir with installers>...");
    process.exit(1);
}

const lines = [];
const seen = new Set();
for (const dir of inputDirs) {
    for (const name of fs.readdirSync(dir).sort()) {
        const file = path.join(dir, name);
        if (!INSTALLER.test(name) || !fs.statSync(file).isFile()) continue;
        if (seen.has(name)) {
            console.error(`Duplicate installer name: ${name}`);
            process.exit(1);
        }
        seen.add(name);
        lines.push(`${sha256(file)}  ${name}`);
    }
}
if (lines.length === 0) {
    console.error("No installers found");
    process.exit(1);
}
lines.sort((a, b) => a.slice(66).localeCompare(b.slice(66)));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "SHA256SUMS.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
