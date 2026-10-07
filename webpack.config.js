const path = require("path");
const { DefinePlugin } = require("webpack");
const HTMLWebpackPlugin = require("html-webpack-plugin");

const BCUP_PACKAGE_PATH = path.join(__dirname, "node_modules/buttercup/package.json");

const pkgInfo = require("./package.json");
const bcupCoreInfo = require(BCUP_PACKAGE_PATH);

module.exports = [
    {
        devtool: false,

        entry: path.resolve(__dirname, "./source/main/index.ts"),

        externals: [
            "@codekunde/conceal-clipboard",
            "delayable-setinterval",
            "electron",
            "electron-builder",
            "electron-is-dev",
            "electron-updater",
            "express",
            "keytar",
            "os-locale",
            "stacktracey",
            "zod"
        ].reduce((output, name) => ({ ...output, [name]: name }), {}),

        module: {
            rules: [
                {
                    test: /\.ts$/,
                    use: [
                        {
                            loader: "ts-loader",
                            options: {
                                configFile: path.resolve(__dirname, "./tsconfig.json")
                            }
                        }
                    ],
                    exclude: /node_modules/
                }
            ]
        },

        output: {
            filename: "index.js",
            libraryTarget: "commonjs2",
            path: path.resolve(__dirname, "./build/main")
        },

        resolve: {
            extensions: [".ts", ".js"]
        },

        target: "electron-main",

        watchOptions: {
            poll: 1000,
            ignored: /node_modules/
        }
    },
    {
        devtool: false,

        entry: path.resolve(__dirname, "./source/renderer/index.tsx"),

        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: [
                        {
                            loader: "ts-loader",
                            options: {
                                configFile: path.resolve(__dirname, "./tsconfig.web.json")
                            }
                        }
                    ],
                    exclude: /node_modules/
                },
                {
                    test: /\.(png|jpe?g|gif)$/i,
                    use: "file-loader"
                },
                {
                    test: /\.(ttf|otf|woff|woff2|eot)$/i,
                    use: "file-loader"
                },
                {
                    test: /\.css$/i,
                    use: ["style-loader", "css-loader"]
                },
                {
                    test: /\.s[ac]ss$/i,
                    use: [
                        "style-loader",
                        "css-loader",
                        {
                            loader: "sass-loader",
                            options: {
                                implementation: require("sass")
                            }
                        }
                    ]
                }
            ]
        },

        output: {
            filename: "index.js",
            path: path.resolve(__dirname, "./build/renderer")
        },

        plugins: [
            new HTMLWebpackPlugin({
                filename: "index.html",
                inject: "body",
                template: path.resolve(__dirname, "./resources/renderer.html")
            }),
            new DefinePlugin({
                __CORE_VERSION__: JSON.stringify(bcupCoreInfo.version),
                __VERSION__: JSON.stringify(pkgInfo.version)
            })
        ],

        resolve: {
            alias: {
                // Node's built-ins the window's code reaches, replaced so the bundle needs
                // no Node access (B-475): the generator's webcrypto, and posix paths for
                // join-path (it joins URL and WebDAV paths, never file system ones)
                crypto$: path.resolve(__dirname, "./resources/webpack-shims/crypto.js"),
                path$: require.resolve("path-posix"),
                util$: path.resolve(__dirname, "./resources/webpack-shims/util.js"),
                buttercup: require.resolve("buttercup/web"),
                "react-dnd": path.resolve("node_modules/react-dnd"),
                "react/jsx-runtime": "react/jsx-runtime.js"
            },
            extensions: [".tsx", ".ts", ".js"]
        },

        // Built for the web, not for Node (B-475): the window has no Node access, and
        // reaches the main process only through the preload script's bridge. Every Node
        // built-in its code used has a replacement above.
        // The size hints are for web pages loaded over a network
        performance: {
            hints: false
        },

        target: "web",

        watchOptions: {
            poll: 1000,
            ignored: /node_modules/
        }
    },
    {
        devtool: false,

        entry: path.resolve(__dirname, "./source/preload/index.ts"),

        externals: {
            electron: "commonjs electron"
        },

        module: {
            rules: [
                {
                    test: /\.ts$/,
                    use: [
                        {
                            loader: "ts-loader",
                            options: {
                                configFile: path.resolve(__dirname, "./tsconfig.json")
                            }
                        }
                    ],
                    exclude: /node_modules/
                }
            ]
        },

        output: {
            filename: "index.js",
            libraryTarget: "commonjs2",
            path: path.resolve(__dirname, "./build/preload")
        },

        resolve: {
            extensions: [".ts", ".js"]
        },

        target: "electron-preload"
    }
];
