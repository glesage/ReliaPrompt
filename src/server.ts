import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

import {
    initializeDatabase,
    initializeDefaultConfigs,
    getAllConfig,
    setConfig,
    createPrompt,
    getLatestPrompts,
    getPromptVersionsByGroupId,
    getLatestPromptForGroupId,
    getPromptByIdOrFail,
    deletePrompt,
    deleteAllVersionsOfPrompt,
    createTestCase,
    getTestCasesForPrompt,
    getTestCaseById,
    deleteTestCase,
    updateTestCase,
    getTestJobByIdOrFail,
    getTestJobsForPrompt,
    deleteAllTestCasesForPromptGroup,
    bulkCreateTestCases,
    clearAllData,
} from "./database";
import { refreshClients, getAllAvailableModels } from "./llm-clients";
import { startTestRun, getTestProgress, TestResults } from "./services/test-runner";
import { getErrorMessage, getErrorStatusCode, NotFoundError } from "./errors";
import { parse, ParseType } from "./utils/parse";
import { validate, validateIdParam } from "./middleware/validation";
import {
    configBodySchema,
    createPromptSchema,
    createTestCaseSchema,
    updateTestCaseSchema,
    importTestCasesSchema,
    importPromptsSchema,
    testRunSchema,
    jobIdParamSchema,
} from "./validation/schemas";
import { validateEnv } from "./config/env";

// Validate environment variables at startup
const env = validateEnv();
const DEFAULT_PORT = env.PORT;

const app = express();

app.use(cors());
app.use(express.json());

// Determine static file directory: prefer Svelte build, fall back to legacy public
const svelteBuildPath = path.join(__dirname, "..", "frontend", "dist");
const legacyPublicPath = path.join(__dirname, "..", "public");
const staticPath = fs.existsSync(svelteBuildPath) ? svelteBuildPath : legacyPublicPath;

app.use(express.static(staticPath));

let dbInitialized = false;

app.use((req, res, next) => {
    if (!dbInitialized && !req.path.startsWith("/api")) {
        return next();
    }
    if (!dbInitialized) {
        return res.status(503).json({ error: "Database initializing, please wait..." });
    }
    next();
});

app.get("/api/config", (req, res) => {
    try {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate");
        const config = getAllConfig();
        res.json(config);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.post("/api/config", validate(configBodySchema), (req, res) => {
    try {
        const {
            openai_api_key,
            bedrock_access_key_id,
            bedrock_secret_access_key,
            bedrock_session_token,
            bedrock_region,
            cerebras_api_key,
            deepseek_api_key,
            gemini_api_key,
            groq_api_key,
            openrouter_api_key,
            selected_models,
        } = req.body;

        if (openai_api_key !== undefined) setConfig("openai_api_key", openai_api_key);
        if (bedrock_access_key_id !== undefined) {
            setConfig("bedrock_access_key_id", bedrock_access_key_id);
        }
        if (bedrock_secret_access_key !== undefined) {
            setConfig("bedrock_secret_access_key", bedrock_secret_access_key);
        }
        if (bedrock_session_token !== undefined) {
            setConfig("bedrock_session_token", bedrock_session_token);
        }
        if (bedrock_region !== undefined) {
            setConfig("bedrock_region", bedrock_region || "ap-southeast-2");
        }
        if (cerebras_api_key !== undefined) setConfig("cerebras_api_key", cerebras_api_key);
        if (deepseek_api_key !== undefined) setConfig("deepseek_api_key", deepseek_api_key);
        if (gemini_api_key !== undefined) setConfig("gemini_api_key", gemini_api_key);
        if (groq_api_key !== undefined) setConfig("groq_api_key", groq_api_key);
        if (openrouter_api_key !== undefined) setConfig("openrouter_api_key", openrouter_api_key);
        if (selected_models !== undefined) {
            const modelsJson = Array.isArray(selected_models)
                ? JSON.stringify(selected_models)
                : selected_models;
            setConfig("selected_models", modelsJson);
        }

        refreshClients();

        res.json({ success: true, message: "Configuration updated" });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/models", async (req, res) => {
    try {
        const models = await getAllAvailableModels();
        res.json(models);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/prompts", (req, res) => {
    try {
        const prompts = getLatestPrompts();
        res.json(prompts);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/prompts/export", (req, res) => {
    try {
        const prompts = getLatestPrompts();

        // Export format: include name, content, expected_schema, evaluation_mode, and evaluation_criteria
        const exportData = prompts.map((p) => ({
            name: p.name,
            content: p.content,
            expected_schema: p.expectedSchema || null,
            evaluation_mode: p.evaluationMode || "schema",
            evaluation_criteria: p.evaluationCriteria || null,
        }));

        res.json(exportData);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.post("/api/prompts/import", validate(importPromptsSchema), (req, res) => {
    try {
        const promptsData = req.body as Array<{
            name: string;
            content: string;
            expected_schema?: string | null;
            evaluation_mode?: "schema" | "llm";
            evaluation_criteria?: string | null;
        }>;

        const existingPrompts = getLatestPrompts();
        const existingNames = new Set(existingPrompts.map((p) => p.name.toLowerCase()));

        const created: Array<{ name: string; id: number }> = [];
        const skipped: string[] = [];

        for (const promptData of promptsData) {
            // Skip if a prompt with this name already exists
            if (existingNames.has(promptData.name.toLowerCase())) {
                skipped.push(promptData.name);
                continue;
            }

            const prompt = createPrompt(
                promptData.name,
                promptData.content,
                undefined,
                promptData.expected_schema || undefined,
                promptData.evaluation_mode || "schema",
                promptData.evaluation_criteria || undefined
            );
            created.push({ name: prompt.name, id: prompt.id });
            existingNames.add(promptData.name.toLowerCase());
        }

        res.json({
            success: true,
            created: created.length,
            skipped: skipped.length,
            skippedNames: skipped,
        });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.post("/api/prompts", validate(createPromptSchema), (req, res) => {
    try {
        const {
            name,
            content,
            parentVersionId,
            expectedSchema,
            evaluationMode,
            evaluationCriteria,
        } = req.body;

        const prompt = createPrompt(
            name,
            content,
            parentVersionId,
            expectedSchema,
            evaluationMode,
            evaluationCriteria
        );
        res.json(prompt);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/prompts/:id", validateIdParam, (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const prompt = getPromptByIdOrFail(id);
        res.json(prompt);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/prompts/:id/versions", validateIdParam, (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const prompt = getPromptByIdOrFail(id);

        const groupId = prompt.promptGroupId ?? id;
        const versions = getPromptVersionsByGroupId(groupId);
        res.json(versions);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.delete("/api/prompts/:id", validateIdParam, (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        getPromptByIdOrFail(id);
        deletePrompt(id);
        res.json({ success: true });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.delete("/api/prompts/:id/all-versions", validateIdParam, (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        deleteAllVersionsOfPrompt(id);
        res.json({ success: true });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/prompts/:id/test-cases", validateIdParam, (req, res) => {
    try {
        const promptId = parseInt(req.params.id, 10);
        const testCases = getTestCasesForPrompt(promptId);
        res.json(testCases);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/prompts/:id/test-cases/export", validateIdParam, (req, res) => {
    try {
        const promptId = parseInt(req.params.id, 10);
        const prompt = getPromptByIdOrFail(promptId);
        const testCases = getTestCasesForPrompt(promptId);

        // Export format: exclude internal IDs and timestamps
        // For LLM evaluation prompts, expected output fields are optional.
        const exportData =
            (prompt.evaluationMode || "schema") === "llm"
                ? testCases.map((tc) => ({
                      input: tc.input,
                  }))
                : testCases.map((tc) => ({
                      input: tc.input,
                      expected_output: tc.expectedOutput,
                      expected_output_type: tc.expectedOutputType,
                  }));

        res.json(exportData);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.post(
    "/api/prompts/:id/test-cases",
    validateIdParam,
    validate(createTestCaseSchema),
    (req, res) => {
        try {
            const promptId = parseInt(req.params.id, 10);
            const { input, expected_output, expected_output_type } = req.body;

            const prompt = getPromptByIdOrFail(promptId);
            const promptGroupId = prompt.promptGroupId ?? promptId;
            const evaluationMode = (prompt.evaluationMode || "schema") as "schema" | "llm";

            const resolvedExpectedOutput =
                evaluationMode === "llm" ? "[]" : (expected_output as string | undefined)?.trim();
            const resolvedExpectedOutputType =
                evaluationMode === "llm"
                    ? ParseType.ARRAY
                    : (expected_output_type as ParseType | undefined);

            if (evaluationMode !== "llm") {
                if (!resolvedExpectedOutput) {
                    return res.status(400).json({
                        error: "Validation error: expected_output is required for schema evaluation prompts",
                    });
                }
                if (!resolvedExpectedOutputType) {
                    return res.status(400).json({
                        error: "Validation error: expected_output_type is required for schema evaluation prompts",
                    });
                }
                // Additional validation: ensure expected_output can be parsed with the specified type
                try {
                    parse(resolvedExpectedOutput, resolvedExpectedOutputType);
                } catch {
                    return res.status(400).json({
                        error: "Validation error: expected_output must be valid JSON matching the expected_output_type",
                    });
                }
            }

            const testCase = createTestCase(
                promptGroupId,
                input,
                resolvedExpectedOutput ?? "[]",
                resolvedExpectedOutputType ?? ParseType.ARRAY
            );
            res.json(testCase);
        } catch (error) {
            res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
        }
    }
);

app.put("/api/test-cases/:id", validateIdParam, validate(updateTestCaseSchema), (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { input, expected_output, expected_output_type } = req.body;

        const existing = getTestCaseById(id);
        if (!existing) {
            throw new NotFoundError("Test case", id);
        }

        const latestPrompt = getLatestPromptForGroupId(existing.promptGroupId);
        const evaluationMode =
            ((latestPrompt?.evaluationMode || "schema") as "schema" | "llm") ?? "schema";

        const resolvedExpectedOutput =
            evaluationMode === "llm"
                ? existing.expectedOutput?.trim()
                    ? existing.expectedOutput
                    : "[]"
                : (expected_output as string | undefined)?.trim();
        const resolvedExpectedOutputType =
            evaluationMode === "llm"
                ? ((existing.expectedOutputType as ParseType) ?? ParseType.ARRAY)
                : (expected_output_type as ParseType | undefined);

        if (evaluationMode !== "llm") {
            if (!resolvedExpectedOutput) {
                return res.status(400).json({
                    error: "Validation error: expected_output is required for schema evaluation prompts",
                });
            }
            if (!resolvedExpectedOutputType) {
                return res.status(400).json({
                    error: "Validation error: expected_output_type is required for schema evaluation prompts",
                });
            }
            // Additional validation: ensure expected_output can be parsed with the specified type
            try {
                parse(resolvedExpectedOutput, resolvedExpectedOutputType);
            } catch {
                return res.status(400).json({
                    error: "Validation error: expected_output must be valid JSON matching the expected_output_type",
                });
            }
        }

        const testCase = updateTestCase(
            id,
            input,
            resolvedExpectedOutput ?? "[]",
            resolvedExpectedOutputType ?? ParseType.ARRAY
        );
        if (!testCase) {
            throw new NotFoundError("Test case", id);
        }
        res.json(testCase);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.delete("/api/test-cases/:id", validateIdParam, (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        deleteTestCase(id);
        res.json({ success: true });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.post(
    "/api/prompts/:id/test-cases/import",
    validateIdParam,
    validate(importTestCasesSchema),
    (req, res) => {
        try {
            const promptId = parseInt(req.params.id, 10);
            const testCasesData = req.body as Array<{
                input: string;
                expected_output?: string;
                expected_output_type?: string;
            }>;

            const prompt = getPromptByIdOrFail(promptId);
            const promptGroupId = prompt.promptGroupId ?? promptId;
            const evaluationMode = (prompt.evaluationMode || "schema") as "schema" | "llm";

            if (evaluationMode !== "llm") {
                // Validate all test cases can be parsed with their specified types
                for (const tc of testCasesData) {
                    const expectedOutput = tc.expected_output?.trim();
                    const expectedType = tc.expected_output_type as ParseType | undefined;
                    if (!expectedOutput || !expectedType) {
                        return res.status(400).json({
                            error: `Validation error: expected_output and expected_output_type are required for schema evaluation prompts (test case "${tc.input.substring(0, 50)}...")`,
                        });
                    }
                    try {
                        parse(expectedOutput, expectedType);
                    } catch {
                        return res.status(400).json({
                            error: `Validation error: expected_output for test case "${tc.input.substring(0, 50)}..." must be valid JSON matching the expected_output_type`,
                        });
                    }
                }
            }

            // Delete all existing test cases for this prompt group
            deleteAllTestCasesForPromptGroup(promptGroupId);

            // Create new test cases from imported data
            const created = bulkCreateTestCases(
                promptGroupId,
                testCasesData.map((tc) => ({
                    input: tc.input,
                    expectedOutput:
                        evaluationMode === "llm" ? "[]" : (tc.expected_output?.trim() ?? "[]"),
                    expectedOutputType:
                        evaluationMode === "llm"
                            ? ParseType.ARRAY
                            : ((tc.expected_output_type as ParseType | undefined) ??
                              ParseType.ARRAY),
                }))
            );

            res.json({ success: true, count: created.length });
        } catch (error) {
            res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
        }
    }
);

app.post("/api/test/run", validate(testRunSchema), async (req, res) => {
    try {
        const {
            promptId,
            runsPerTest,
            selectedModels,
            evaluationModel,
            optimizationMaxIterations,
            optimizationThreshold,
            optimizationModel,
        } = req.body;

        const jobId = await startTestRun(
            promptId,
            runsPerTest,
            selectedModels,
            evaluationModel,
            optimizationMaxIterations,
            optimizationThreshold,
            optimizationModel
        );
        res.json({ jobId });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/test/status/:jobId", validate(jobIdParamSchema, "params"), (req, res) => {
    try {
        const { jobId } = req.params;

        const progress = getTestProgress(jobId);
        if (progress) {
            return res.json(progress);
        }

        const job = getTestJobByIdOrFail(jobId);
        const results: TestResults | null = job.results
            ? (JSON.parse(job.results) as TestResults)
            : null;
        res.json({
            jobId: job.id,
            status: job.status,
            totalTests: job.totalTests,
            completedTests: job.completedTests,
            progress:
                job.totalTests > 0 ? Math.round((job.completedTests / job.totalTests) * 100) : 0,
            results,
        });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/prompts/:id/test-jobs", validateIdParam, (req, res) => {
    try {
        const promptId = parseInt(req.params.id, 10);
        const jobs = getTestJobsForPrompt(promptId);
        res.json(jobs);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

// Clear all database data (only available in test mode)
app.delete("/api/test/clear", (req, res) => {
    try {
        clearAllData();
        res.json({ message: "All data cleared successfully" });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

// SPA fallback: serve index.html for all non-API routes
app.get("/{*path}", (req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
});

export interface ServerOptions {
    port?: number;
    useMemoryDatabase?: boolean;
}

export interface ServerInstance {
    server: ReturnType<typeof app.listen>;
    port: number;
    baseUrl: string;
    close: () => Promise<void>;
}

export async function startServer(options: ServerOptions = {}): Promise<ServerInstance> {
    const port = options.port ?? DEFAULT_PORT;

    try {
        initializeDatabase();
        initializeDefaultConfigs();
        dbInitialized = true;

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
    } catch (error) {
        console.error("Failed to start server:", error);
        throw error;
    }
}

function start() {
    startServer()
        .then(() => {
            // Server started successfully
        })
        .catch((error) => {
            console.error("Failed to start server:", error);
            process.exit(1);
        });
}

// Only start automatically if this file is run directly (not imported)
// @ts-expect-error - import.meta.main is a Bun-specific feature
if (import.meta.main) {
    start();
}
