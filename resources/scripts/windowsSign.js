const { exec } = require("child_process");
const { promisify } = require("util");
const { basename } = require("path");
const chalk = require("chalk");

const execute = promisify(exec);

exports.default = async (configuration) => {
    const { WIN_YUBIKEY_PIN } = process.env;

    if (!WIN_YUBIKEY_PIN) {
        console.log(
            chalk.yellow(
                ` · Skipping Windows code signing: WIN_YUBIKEY_PIN not set (unsigned build)`
            )
        );
        return;
    }

    console.log(` ${chalk.greenBright("·")} ${basename(configuration.path)}`);

    const { stdout, stderr } = await execute(
        [
            "jsign",
            "--storetype YUBIKEY",
            `--storepass ${WIN_YUBIKEY_PIN}`,
            `--alias "X.509 Certificate for PIV Authentication"`,
            `"${configuration.path}"`
        ].join(" ")
    );

    console.log(stdout);
    if (stderr) {
        console.log(chalk.red(stderr));
    }
};
