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
	getPromptById,
	getAllPrompts,
	deletePrompt,
	deletePromptByName,
	createTestCase,
	getTestCasesForPrompt,
	deleteTestCase,
	updateTestCase,
	getTestJobById,
} from "./database";
import { refreshClients, getConfiguredClients } from "./llm-clients";
import { startTestRun, getTestProgress } from "./services/test-runner";
import {
	startImprovement,
	getImprovementProgress,
} from "./services/improvement-service";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Database initialization flag
let dbInitialized = false;

// Middleware to ensure DB is ready
app.use((req, res, next) => {
	if (!dbInitialized && !req.path.startsWith("/api")) {
		return next();
	}
	if (!dbInitialized) {
		return res
			.status(503)
			.json({ error: "Database initializing, please wait..." });
	}
	next();
});

// ============== CONFIG ROUTES ==============

// Get all config
app.get("/api/config", (req, res) => {
	try {
		const config = getAllConfig();
		// Mask API keys for security
		const masked: Record<string, string> = {};
		for (const [key, value] of Object.entries(config)) {
			if (key.includes("key") || key.includes("secret")) {
				masked[key] = value ? "***configured***" : "";
			} else {
				masked[key] = value;
			}
		}
		res.json(masked);
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// Update config
app.post("/api/config", (req, res) => {
	try {
		const {
			openai_api_key,
			bedrock_access_key_id,
			bedrock_secret_access_key,
			bedrock_region,
			grok_api_key,
		} = req.body;

		if (openai_api_key !== undefined)
			setConfig("openai_api_key", openai_api_key);
		if (bedrock_access_key_id !== undefined)
			setConfig("bedrock_access_key_id", bedrock_access_key_id);
		if (bedrock_secret_access_key !== undefined)
			setConfig("bedrock_secret_access_key", bedrock_secret_access_key);
		if (bedrock_region !== undefined)
			setConfig("bedrock_region", bedrock_region || "us-east-1");
		if (grok_api_key !== undefined) setConfig("grok_api_key", grok_api_key);

		refreshClients();

		res.json({ success: true, message: "Configuration updated" });
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// Get configured LLM providers
app.get("/api/config/providers", (req, res) => {
	try {
		const clients = getConfiguredClients();
		res.json({
			providers: clients.map((c) => c.name),
			count: clients.length,
		});
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// ============== PROMPT ROUTES ==============

// Get all prompts (latest versions)
app.get("/api/prompts", (req, res) => {
	try {
		const prompts = getLatestPrompts();
		res.json(prompts);
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// Get all prompt versions
app.get("/api/prompts/all", (req, res) => {
	try {
		const prompts = getAllPrompts();
		res.json(prompts);
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// Create a new prompt
app.post("/api/prompts", (req, res) => {
	try {
		const { name, content, parentVersionId } = req.body;

		if (!name || !content) {
			return res.status(400).json({ error: "Name and content are required" });
		}

		const prompt = createPrompt(name, content, parentVersionId);
		res.json(prompt);
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// Get a specific prompt
app.get("/api/prompts/:id", (req, res) => {
	try {
		const id = parseInt(req.params.id, 10);
		const prompt = getPromptById(id);

		if (!prompt) {
			return res.status(404).json({ error: "Prompt not found" });
		}

		res.json(prompt);
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// Get versions of a prompt by name
app.get("/api/prompts/:name/versions", (req, res) => {
	try {
		const versions = getPromptVersions(req.params.name);
		res.json(versions);
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// Delete a specific prompt version
app.delete("/api/prompts/:id", (req, res) => {
	try {
		const id = parseInt(req.params.id, 10);
		const prompt = getPromptById(id);
		if (!prompt) {
			return res.status(404).json({ error: "Prompt not found" });
		}
		deletePrompt(id);
		res.json({ success: true });
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// Delete all versions of a prompt by name
app.delete("/api/prompts/name/:name", (req, res) => {
	try {
		deletePromptByName(req.params.name);
		res.json({ success: true });
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// ============== TEST CASE ROUTES ==============

// Get test cases for a prompt
app.get("/api/prompts/:id/test-cases", (req, res) => {
	try {
		const promptId = parseInt(req.params.id, 10);
		const testCases = getTestCasesForPrompt(promptId);
		res.json(testCases);
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// Create a test case
app.post("/api/prompts/:id/test-cases", (req, res) => {
	try {
		const promptId = parseInt(req.params.id, 10);
		const { input, expected_output } = req.body;

		if (!input || !expected_output) {
			return res
				.status(400)
				.json({ error: "Input and expected_output are required" });
		}

		// Validate that expected_output is valid JSON
		try {
			JSON.parse(expected_output);
		} catch {
			return res
				.status(400)
				.json({ error: "expected_output must be valid JSON" });
		}

		const testCase = createTestCase(promptId, input, expected_output);
		res.json(testCase);
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// Update a test case
app.put("/api/test-cases/:id", (req, res) => {
	try {
		const id = parseInt(req.params.id, 10);
		const { input, expected_output } = req.body;

		if (!input || !expected_output) {
			return res
				.status(400)
				.json({ error: "Input and expected_output are required" });
		}

		// Validate that expected_output is valid JSON
		try {
			JSON.parse(expected_output);
		} catch {
			return res
				.status(400)
				.json({ error: "expected_output must be valid JSON" });
		}

		const testCase = updateTestCase(id, input, expected_output);
		if (!testCase) {
			return res.status(404).json({ error: "Test case not found" });
		}
		res.json(testCase);
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// Delete a test case
app.delete("/api/test-cases/:id", (req, res) => {
	try {
		const id = parseInt(req.params.id, 10);
		deleteTestCase(id);
		res.json({ success: true });
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// ============== TEST RUN ROUTES ==============

// Start a test run
app.post("/api/test/run", async (req, res) => {
	try {
		const { promptId } = req.body;

		if (!promptId) {
			return res.status(400).json({ error: "promptId is required" });
		}

		const jobId = await startTestRun(promptId);
		res.json({ jobId });
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// Get test run status
app.get("/api/test/status/:jobId", (req, res) => {
	try {
		const { jobId } = req.params;

		// First check in-memory progress
		const progress = getTestProgress(jobId);
		if (progress) {
			return res.json(progress);
		}

		// Fall back to database
		const job = getTestJobById(jobId);
		if (!job) {
			return res.status(404).json({ error: "Job not found" });
		}

		res.json({
			jobId: job.id,
			status: job.status,
			totalTests: job.totalTests,
			completedTests: job.completedTests,
			progress:
				job.totalTests > 0
					? Math.round((job.completedTests / job.totalTests) * 100)
					: 0,
			results: job.results ? JSON.parse(job.results) : null,
		});
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// ============== IMPROVEMENT ROUTES ==============

// Start improvement job
app.post("/api/improve/start", async (req, res) => {
	try {
		const { promptId, maxIterations } = req.body;

		if (!promptId) {
			return res.status(400).json({ error: "promptId is required" });
		}

		const iterations = maxIterations || 5;
		const jobId = await startImprovement(promptId, iterations);
		res.json({ jobId });
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// Get improvement status
app.get("/api/improve/status/:jobId", (req, res) => {
	try {
		const { jobId } = req.params;

		const progress = getImprovementProgress(jobId);
		if (progress) {
			return res.json(progress);
		}

		// Fall back to database
		const job = require("./database").getImprovementJobById(jobId);
		if (!job) {
			return res.status(404).json({ error: "Job not found" });
		}

		res.json({
			jobId: job.id,
			status: job.status,
			currentIteration: job.current_iteration,
			maxIterations: job.max_iterations,
			bestScore: job.best_score,
			bestPromptContent: job.best_prompt_content,
			originalScore: null,
			log: job.log ? job.log.split("\n").filter((l: string) => l) : [],
		});
	} catch (error) {
		res.status(500).json({ error: (error as Error).message });
	}
});

// ============== SERVE FRONTEND ==============

app.get("*", (req, res) => {
	res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// Initialize database and start server
async function start() {
	try {
		console.log("Initializing database...");
		await initializeDatabase();
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
