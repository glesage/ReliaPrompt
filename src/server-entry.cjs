"use strict";

const path = require("path");

globalThis.__RELIA_PROMPT_PACKAGE_ROOT__ = path.resolve(__dirname, "..");

const serverModule = require("./server.bundle.cjs");

module.exports = serverModule;

if (require.main === module) {
    serverModule.startServer({ projectRoot: process.cwd() }).catch((error) => {
        console.error("Failed to start server:", error);
        process.exit(1);
    });
}
