import express from "express";
import cors from "cors";
import path from "path";

import {
    initializeDatabase,
    getAllConfig,
    setConfig,
    createPrompt,
    getLatestPrompts,
    getPromptVersions,
    getPromptVersionsByGroupId,
    getPromptByIdOrFail,
    getAllPrompts,
    deletePrompt,
    deleteAllVersionsOfPrompt,
    createTestCase,
    getTestCasesForPrompt,
    deleteTestCase,
    updateTestCase,
    getTestJobByIdOrFail,
    getTestJobsForPrompt,
    getImprovementJobByIdOrFail,
} from "./database";
import {
    refreshClients,
    getConfiguredClients,
    getAllAvailableModels,
    ModelSelection,
} from "./llm-clients";
import { startTestRun, getTestProgress, TestResults } from "./services/test-runner";
import { startImprovement, getImprovementProgress } from "./services/improvement-service";
import { getErrorMessage, getErrorStatusCode, NotFoundError, ValidationError } from "./errors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

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

app.post("/api/config", (req, res) => {
    try {
        const {
            openai_api_key,
            bedrock_access_key_id,
            bedrock_secret_access_key,
            bedrock_session_token,
            bedrock_region,
            deepseek_api_key,
            selected_models,
        } = req.body;

        if (openai_api_key !== undefined) setConfig("openai_api_key", openai_api_key);
        if (bedrock_access_key_id !== undefined)
            setConfig("bedrock_access_key_id", bedrock_access_key_id);
        if (bedrock_secret_access_key !== undefined)
            setConfig("bedrock_secret_access_key", bedrock_secret_access_key);
        if (bedrock_session_token !== undefined)
            setConfig("bedrock_session_token", bedrock_session_token);
        if (bedrock_region !== undefined)
            setConfig("bedrock_region", bedrock_region || "ap-southeast-2");
        if (deepseek_api_key !== undefined) setConfig("deepseek_api_key", deepseek_api_key);
        if (selected_models !== undefined) {
            // Store selected models as JSON string
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

app.get("/api/config/providers", (req, res) => {
    try {
        const clients = getConfiguredClients();
        res.json({
            providers: clients.map((c) => c.name),
            count: clients.length,
        });
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

app.get("/api/prompts/all", (req, res) => {
    try {
        const prompts = getAllPrompts();
        res.json(prompts);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.post("/api/prompts", (req, res) => {
    try {
        const { name, content, parentVersionId } = req.body;

        if (!name || !content) {
            throw new ValidationError("Name and content are required");
        }

        const prompt = createPrompt(name, content, parentVersionId);
        res.json(prompt);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/prompts/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const prompt = getPromptByIdOrFail(id);
        res.json(prompt);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

// Get versions by prompt group ID (preferred)
app.get("/api/prompts/:id/versions", (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const prompt = getPromptByIdOrFail(id);

        // Use promptGroupId if available, otherwise fall back to the prompt's own ID
        const groupId = prompt.promptGroupId ?? id;
        const versions = getPromptVersionsByGroupId(groupId);
        res.json(versions);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

// Legacy: Get versions by name (for backward compatibility)
app.get("/api/prompts/by-name/:name/versions", (req, res) => {
    try {
        const versions = getPromptVersions(req.params.name);
        res.json(versions);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.delete("/api/prompts/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        // Verify prompt exists before deleting
        getPromptByIdOrFail(id);
        deletePrompt(id);
        res.json({ success: true });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.delete("/api/prompts/:id/all-versions", (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        deleteAllVersionsOfPrompt(id);
        res.json({ success: true });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/prompts/:id/test-cases", (req, res) => {
    try {
        const promptId = parseInt(req.params.id, 10);
        const testCases = getTestCasesForPrompt(promptId);
        res.json(testCases);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.post("/api/prompts/:id/test-cases", (req, res) => {
    try {
        const promptId = parseInt(req.params.id, 10);
        const { input, expected_output } = req.body;

        if (!input || !expected_output) {
            throw new ValidationError("Input and expected_output are required");
        }

        try {
            JSON.parse(expected_output);
        } catch {
            throw new ValidationError("expected_output must be valid JSON");
        }

        const testCase = createTestCase(promptId, input, expected_output);
        res.json(testCase);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.put("/api/test-cases/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { input, expected_output } = req.body;

        if (!input || !expected_output) {
            throw new ValidationError("Input and expected_output are required");
        }

        try {
            JSON.parse(expected_output);
        } catch {
            throw new ValidationError("expected_output must be valid JSON");
        }

        const testCase = updateTestCase(id, input, expected_output);
        if (!testCase) {
            throw new NotFoundError("Test case", id);
        }
        res.json(testCase);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.delete("/api/test-cases/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        deleteTestCase(id);
        res.json({ success: true });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.post("/api/test/run", async (req, res) => {
    try {
        const { promptId, runsPerTest, selectedModels } = req.body;

        if (!promptId) {
            throw new ValidationError("promptId is required");
        }

        if (runsPerTest === undefined || runsPerTest === null) {
            throw new ValidationError("runsPerTest is required");
        }

        const runs = parseInt(runsPerTest, 10);
        if (isNaN(runs) || runs < 1 || runs > 100) {
            throw new ValidationError("runsPerTest must be a number between 1 and 100");
        }

        // Parse selectedModels - can be passed as array or retrieved from config
        let models: ModelSelection[] | undefined;
        if (selectedModels && Array.isArray(selectedModels) && selectedModels.length > 0) {
            models = selectedModels as ModelSelection[];
        }

        const jobId = await startTestRun(promptId, runs, models);
        res.json({ jobId });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/test/status/:jobId", (req, res) => {
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

app.get("/api/prompts/:id/test-jobs", (req, res) => {
    try {
        const promptId = parseInt(req.params.id, 10);
        const jobs = getTestJobsForPrompt(promptId);
        res.json(jobs);
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.post("/api/improve/start", async (req, res) => {
    try {
        const { promptId, maxIterations, runsPerLlm, selectedModels } = req.body;

        if (!promptId) {
            throw new ValidationError("promptId is required");
        }

        const iterations = maxIterations || 5;
        const runs = runsPerLlm || 1;

        // Parse selectedModels - can be passed as array or retrieved from config
        let models: ModelSelection[] | undefined;
        if (selectedModels && Array.isArray(selectedModels) && selectedModels.length > 0) {
            models = selectedModels as ModelSelection[];
        }

        const jobId = await startImprovement(promptId, iterations, runs, models);
        res.json({ jobId });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/api/improve/status/:jobId", (req, res) => {
    try {
        const { jobId } = req.params;

        const progress = getImprovementProgress(jobId);
        if (progress) {
            return res.json(progress);
        }

        const job = getImprovementJobByIdOrFail(jobId);
        res.json({
            jobId: job.id,
            status: job.status,
            currentIteration: job.currentIteration,
            maxIterations: job.maxIterations,
            bestScore: job.bestScore,
            bestPromptContent: job.bestPromptContent,
            originalScore: null,
            log: job.log ? job.log.split("\n").filter((l) => l) : [],
        });
    } catch (error) {
        res.status(getErrorStatusCode(error)).json({ error: getErrorMessage(error) });
    }
});

app.get("/{*path}", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

function start() {
    try {
        console.log("Initializing database...");
        initializeDatabase();
        dbInitialized = true;
        console.log("Database initialized");

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
            console.log(`API available at http://localhost:${PORT}/api`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

start();
