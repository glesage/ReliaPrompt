import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import type { PromptSuiteDefinition } from "./types";

export interface ReliaPromptConfig {
    /** Paths to files that export prompt/suite definitions (relative to project root). */
    definitionFiles?: string[];
}

const DEFAULT_DEFINITION_FILES = [
    "reliaprompt.definitions.ts",
    "reliaprompt.definitions.js",
    "src/reliaprompt.definitions.ts",
    "src/reliaprompt.definitions.js",
];

/**
 * Load config from project root. Tries reliaprompt.config.ts then reliaprompt.config.js.
 */
export async function loadConfig(projectRoot: string): Promise<ReliaPromptConfig | null> {
    const candidates = [
        path.join(projectRoot, "reliaprompt.config.ts"),
        path.join(projectRoot, "reliaprompt.config.js"),
    ];
    for (const configPath of candidates) {
        if (fs.existsSync(configPath)) {
            try {
                const mod = await import(pathToFileURL(configPath).href);
                const config = mod.default ?? mod;
                if (config && typeof config === "object" && Array.isArray(config.definitionFiles)) {
                    return { definitionFiles: config.definitionFiles };
                }
                if (config && typeof config === "object") {
                    return config as ReliaPromptConfig;
                }
            } catch {
                // Ignore load errors, try next
            }
        }
    }
    return null;
}

/**
 * Load suite definitions from a single file (dynamic import).
 * Expects the file to export `suites: PromptSuiteDefinition[]` or default export with same.
 */
async function loadSuitesFromFile(filePath: string): Promise<PromptSuiteDefinition[]> {
    const url = pathToFileURL(filePath).href;
    const mod = await import(url);
    const suites = mod.suites ?? mod.default?.suites;
    if (!Array.isArray(suites)) {
        return [];
    }
    return suites.filter(
        (s: unknown) => s && typeof s === "object" && "id" in s && "prompt" in s && "testCases" in s
    ) as PromptSuiteDefinition[];
}

/**
 * Scan project and load all prompt suite definitions from configured files.
 * Used by UI mode to display prompts and tests from code.
 *
 * @param projectRoot - Root directory of the service (e.g. process.cwd())
 * @param options - Optional config path or explicit definition file list
 * @returns Flat list of all suites from all definition files
 */
export async function loadDefinitionsFromProject(
    projectRoot: string,
    options?: { configPath?: string; definitionFiles?: string[] }
): Promise<PromptSuiteDefinition[]> {
    let definitionFiles: string[];

    if (options?.definitionFiles && options.definitionFiles.length > 0) {
        definitionFiles = options.definitionFiles;
    } else if (options?.configPath && fs.existsSync(options.configPath)) {
        try {
            const mod = await import(pathToFileURL(options.configPath).href);
            const config = mod.default ?? mod;
            definitionFiles = config?.definitionFiles ?? DEFAULT_DEFINITION_FILES;
        } catch {
            definitionFiles = DEFAULT_DEFINITION_FILES;
        }
    } else {
        const config = await loadConfig(projectRoot);
        definitionFiles = config?.definitionFiles ?? DEFAULT_DEFINITION_FILES;
    }

    const allSuites: PromptSuiteDefinition[] = [];
    for (const file of definitionFiles) {
        const absolutePath = path.isAbsolute(file) ? file : path.join(projectRoot, file);
        if (!fs.existsSync(absolutePath)) {
            continue;
        }
        try {
            const suites = await loadSuitesFromFile(absolutePath);
            allSuites.push(...suites);
        } catch {
            // Skip files that fail to load (e.g. syntax error or missing deps)
        }
    }
    return allSuites;
}
