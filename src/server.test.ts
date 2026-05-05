import { describe, expect, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { getPackageRoot, resolveStaticAssetPaths } from "./server";

const PACKAGE_ROOT_GLOBAL_KEY = "__RELIA_PROMPT_PACKAGE_ROOT__";

function createTemporaryPackageRoot(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "relia-prompt-package-"));
}

function getReliaPromptGlobal(): typeof globalThis & {
    [PACKAGE_ROOT_GLOBAL_KEY]?: string;
} {
    return globalThis as typeof globalThis & { [PACKAGE_ROOT_GLOBAL_KEY]?: string };
}

describe("server static asset paths", () => {
    test("resolves dashboard assets from the package root for bundled server output", () => {
        const packageRoot = createTemporaryPackageRoot();
        try {
            const dashboardPath = path.join(packageRoot, "dashboard", "dist");
            fs.mkdirSync(dashboardPath, { recursive: true });
            fs.writeFileSync(path.join(dashboardPath, "index.html"), "<html></html>");

            const paths = resolveStaticAssetPaths(path.join(packageRoot, "dist", "server.cjs"));

            expect(paths.packageRoot).toBe(packageRoot);
            expect(paths.staticPath).toBe(dashboardPath);
            expect(paths.indexHtmlPath).toBe(path.join(dashboardPath, "index.html"));
        } finally {
            fs.rmSync(packageRoot, { recursive: true, force: true });
        }
    });

    test("resolves the package root for source and bundled runtime paths", () => {
        const packageRoot = path.join(os.tmpdir(), "relia-prompt");

        expect(getPackageRoot(path.join(packageRoot, "src", "server.ts"))).toBe(packageRoot);
        expect(getPackageRoot(path.join(packageRoot, "dist", "server.cjs"))).toBe(packageRoot);
    });

    test("prefers the package root supplied by the runtime entry wrapper", () => {
        const reliaPromptGlobal = getReliaPromptGlobal();
        const previousPackageRoot = reliaPromptGlobal[PACKAGE_ROOT_GLOBAL_KEY];
        const packageRoot = path.join(os.tmpdir(), "relia-prompt-installed");

        try {
            reliaPromptGlobal[PACKAGE_ROOT_GLOBAL_KEY] = packageRoot;

            expect(getPackageRoot(path.join(os.tmpdir(), "consumer", "server.ts"))).toBe(
                packageRoot
            );
        } finally {
            if (previousPackageRoot === undefined) {
                delete reliaPromptGlobal[PACKAGE_ROOT_GLOBAL_KEY];
            } else {
                reliaPromptGlobal[PACKAGE_ROOT_GLOBAL_KEY] = previousPackageRoot;
            }
        }
    });
});
