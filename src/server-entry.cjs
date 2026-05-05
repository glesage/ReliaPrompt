"use strict";

const path = require("path");

globalThis.__RELIA_PROMPT_PACKAGE_ROOT__ = path.resolve(__dirname, "..");

const serverModule = require("./server.bundle.cjs");

exports.getPackageRoot = serverModule.getPackageRoot;
exports.resolveStaticAssetPaths = serverModule.resolveStaticAssetPaths;
exports.startServer = serverModule.startServer;

if (require.main === module) {
    serverModule.startServer({ projectRoot: process.cwd() }).catch((error) => {
        console.error("Failed to start server:", error);
        process.exit(1);
    });
}
