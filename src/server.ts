import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

import { LLM_CONFIG_KEYS } from "../shared/providers";
import { refreshClients, getAllAvailableModels } from "./llm-clients";
import { getErrorMessage, getErrorStatusCode } from "./errors";
import { validateBody } from "./middleware/validation";
import { validateLibraryRunBody } from "./validation/validators";
import { validateEnv } from "./config/env";
import { setConfigOverlay, getCredentialsFromJsonEnv, loadEnvFile } from "./runtime/config";
import { loadDefinitionsFromProject } from "./definitions/loader";
import { runPromptTestsFromSuite } from "./index";

loadEnvFile(process.cwd());
const env = validateEnv();
const DEFAULT_PORT = env.PORT;

const app = express();

app.use(cors());
app.use(express.json());

const svelteBuildPath = path.join(__dirname, "..", "dashboard", "dist");
const legacyPublicPath = path.join(__dirname, "..", "public");
const staticPath = fs.existsSync(svelteBuildPath) ? svelteBuildPath : legacyPublicPath;

app.use(express.static(staticPath));

let projectRoot: string | null = null;

/** Build read-only config for UI: same keys as LLMConfig, values masked when set. */
function getConfigForApi(): Record<string, string> {
    const credentials = getCredentialsFromJsonEnv();
    const out: Record<string, string> = {};
    for (const key of LLM_CONFIG_KEYS) {
        const v = credentials[key];
        out[key] = v != null && String(v).length > 0 ? "***" : "";
    }
    out.selected_models = "[]";
    return out;
}

app.get("/api/config", (_req, res) => {
    try {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate");
        res.json(getConfigForApi());
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

/** Re-reads RELIA_PROMPT_LLM_CONFIG_JSON and refreshes clients. */
app.post("/api/config", (req, res) => {
    try {
        setConfigOverlay(getCredentialsFromJsonEnv());
        refreshClients();
        res.json({ success: true, message: "Configuration refreshed from environment" });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/models", async (_req, res) => {
    try {
        const models = await getAllAvailableModels();
        res.json(models);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/mode", (_req, res) => {
    res.json({ mode: "library" });
});

app.get("/api/library/suites", async (_req, res) => {
    if (!projectRoot) {
        return res.status(503).json({
            error: "Project root not set. Start the server with projectRoot (e.g. reliaprompt:ui from your project).",
        });
    }
    try {
        const suites = await loadDefinitionsFromProject(projectRoot);
        res.json(suites);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.post("/api/library/test/run", validateBody(validateLibraryRunBody), async (req, res) => {
    if (!projectRoot) {
        return res.status(503).json({
            error: "Project root not set. Start the server with projectRoot (e.g. reliaprompt:ui from your project).",
        });
    }
    try {
        const { suiteId, promptDraft, testModels, evaluationModel, runsPerTest } = req.body;
        const suites = await loadDefinitionsFromProject(projectRoot);
        const suite = suites.find((s) => s.id === suiteId);
        if (!suite) {
            return res.status(404).json({ error: `Suite ${suiteId} not found` });
        }
        const suiteToRun = promptDraft
            ? {
                  ...suite,
                  prompt: {
                      ...suite.prompt,
                      content: promptDraft.content,
                      expectedSchema: promptDraft.expectedSchema ?? suite.prompt.expectedSchema,
                      evaluationMode: promptDraft.evaluationMode ?? suite.prompt.evaluationMode,
                      evaluationCriteria:
                          promptDraft.evaluationCriteria ?? suite.prompt.evaluationCriteria,
                  },
              }
            : suite;
        const result = await runPromptTestsFromSuite(suiteToRun, {
            testModels,
            evaluationModel,
            runsPerTest: runsPerTest ?? 1,
        });
        res.json(result);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/{*path}", (req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
});

export interface ServerOptions {
    port?: number;
    /** Project root for file-scan (definitions live in code under this path). */
    projectRoot?: string;
}

export interface ServerInstance {
    server: ReturnType<typeof app.listen>;
    port: number;
    baseUrl: string;
    close: () => Promise<void>;
}

/** Path to the example service (used when no suites found in project). */
const EXAMPLE_SERVICE_PATH = path.join(__dirname, "..", "example");

export async function startServer(options: ServerOptions = {}): Promise<ServerInstance> {
    const port = options.port ?? DEFAULT_PORT;

    try {
        setConfigOverlay(getCredentialsFromJsonEnv());
    } catch (e) {
        console.error("LLM config (RELIA_PROMPT_LLM_CONFIG_JSON) error:", e);
        setConfigOverlay(null);
    }
    refreshClients();

    let root = options.projectRoot ?? process.cwd();
    let hasSuites = false;
    try {
        const suites = await loadDefinitionsFromProject(root);
        hasSuites = suites.length > 0;
    } catch {
        // ignore load errors
    }
    if (!hasSuites && fs.existsSync(EXAMPLE_SERVICE_PATH)) {
        root = EXAMPLE_SERVICE_PATH;
        console.log(`No suites in project; using example service: ${root}`);
    }
    projectRoot = root;

    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
            resolve({
                server,
                port,
                baseUrl: `http://localhost:${port}`,
                close: () => {
                    return new Promise<void>((resolveClose) => {
                        server.close(() => {
                            resolveClose();
                        });
                    });
                },
            });
        });

        server.on("error", (error) => {
            reject(error);
        });
    });
}

function start() {
    startServer({ projectRoot: process.cwd() })
        .then(() => {})
        .catch((error) => {
            console.error("Failed to start server:", error);
            process.exit(1);
        });
}

// @ts-expect-error - import.meta.main is a Bun-specific feature
if (import.meta.main) {
    start();
}
