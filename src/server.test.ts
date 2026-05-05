import { describe, expect, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { resolveStaticAssetPaths } from "./server";

const PACKAGE_ROOT_GLOBAL_KEY = "__RELIA_PROMPT_PACKAGE_ROOT__";

function createTemporaryPackageRoot(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "relia-prompt-package-"));
}

describe("server static asset paths", () => {
    test("resolves dashboard assets from the package root", () => {
        const packageRoot = createTemporaryPackageRoot();
        try {
            const dashboardPath = path.join(packageRoot, "dashboard", "dist");
            fs.mkdirSync(dashboardPath, { recursive: true });
            fs.writeFileSync(path.join(dashboardPath, "index.html"), "<html></html>");

            const paths = resolveStaticAssetPaths(packageRoot);

            expect(paths.packageRoot).toBe(packageRoot);
            expect(paths.staticPath).toBe(dashboardPath);
            expect(paths.indexHtmlPath).toBe(path.join(dashboardPath, "index.html"));
        } finally {
            fs.rmSync(packageRoot, { recursive: true, force: true });
        }
    });

    test("prefers the package root supplied by the runtime entry wrapper", () => {
        const reliaPromptGlobal = globalThis as typeof globalThis & {
            [PACKAGE_ROOT_GLOBAL_KEY]?: string;
        };
        const previousPackageRoot = reliaPromptGlobal[PACKAGE_ROOT_GLOBAL_KEY];
        const packageRoot = path.join(os.tmpdir(), "relia-prompt-installed");

        try {
            reliaPromptGlobal[PACKAGE_ROOT_GLOBAL_KEY] = packageRoot;

            expect(resolveStaticAssetPaths().packageRoot).toBe(packageRoot);
        } finally {
            if (previousPackageRoot === undefined) {
                delete reliaPromptGlobal[PACKAGE_ROOT_GLOBAL_KEY];
            } else {
                reliaPromptGlobal[PACKAGE_ROOT_GLOBAL_KEY] = previousPackageRoot;
            }
        }
    });
});
