const DEEPSEEK_API_KEY = "sk-a9b720e452444c7d9226f944f365baf9";

export interface ModelSelection {
    provider: string;
    modelId: string;
}

export interface ModelInfo {
    id: string;
    name: string;
    provider: string;
}

/**
 * Configure Deepseek API key
 */
export async function configureDeepseek(baseUrl: string): Promise<void> {
    const response = await fetch(`${baseUrl}/api/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            deepseek_api_key: DEEPSEEK_API_KEY,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to configure Deepseek: ${error.error || response.statusText}`);
    }
}

/**
 * Get available models
 */
export async function getAvailableModels(baseUrl: string): Promise<ModelInfo[]> {
    const response = await fetch(`${baseUrl}/api/models`);
    if (!response.ok) {
        throw new Error(`Failed to get models: ${response.statusText}`);
    }
    const models = await response.json();
    return models;
}

/**
 * Create a prompt
 */
export async function createPrompt(
    baseUrl: string,
    name: string,
    content: string
): Promise<{ id: number; name: string; content: string }> {
    const response = await fetch(`${baseUrl}/api/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name,
            content,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create prompt: ${error.error || response.statusText}`);
    }

    return await response.json();
}

/**
 * Create a test case
 */
export async function createTestCase(
    baseUrl: string,
    promptId: number,
    input: string,
    expectedOutput: string,
    expectedOutputType: string = "array"
): Promise<{ id: number; input: string; expectedOutput: string }> {
    const response = await fetch(`${baseUrl}/api/prompts/${promptId}/test-cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            input,
            expected_output: expectedOutput,
            expected_output_type: expectedOutputType,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create test case: ${error.error || response.statusText}`);
    }

    return await response.json();
}

/**
 * Start a test run
 */
export async function startTestRun(
    baseUrl: string,
    promptId: number,
    selectedModels: ModelSelection[],
    runsPerTest: number = 1
): Promise<{ jobId: string }> {
    const response = await fetch(`${baseUrl}/api/test/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            promptId,
            runsPerTest,
            selectedModels,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to start test run: ${error.error || response.statusText}`);
    }

    return await response.json();
}

/**
 * Get test run status
 */
export async function getTestRunStatus(
    baseUrl: string,
    jobId: string
): Promise<{
    status: string;
    progress: number;
    results?: any;
    error?: string;
}> {
    const response = await fetch(`${baseUrl}/api/test/status/${jobId}`);
    if (!response.ok) {
        throw new Error(`Failed to get test status: ${response.statusText}`);
    }
    return await response.json();
}

/**
 * Start an improvement job
 */
export async function startImprovement(
    baseUrl: string,
    promptId: number,
    improvementModel: ModelSelection,
    benchmarkModels: ModelSelection[],
    maxIterations: number = 1,
    runsPerLlm: number = 1
): Promise<{ jobId: string }> {
    const response = await fetch(`${baseUrl}/api/improve/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            promptId,
            maxIterations,
            runsPerLlm,
            improvementModel,
            benchmarkModels,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to start improvement: ${error.error || response.statusText}`);
    }

    return await response.json();
}

/**
 * Get improvement job status
 */
export async function getImprovementStatus(
    baseUrl: string,
    jobId: string
): Promise<{
    status: string;
    currentIteration: number;
    maxIterations: number;
    bestScore: number | null;
    log: string[];
    error?: string;
}> {
    const response = await fetch(`${baseUrl}/api/improve/status/${jobId}`);
    if (!response.ok) {
        throw new Error(`Failed to get improvement status: ${response.statusText}`);
    }
    return await response.json();
}

/**
 * Wait for test run to complete
 */
export async function waitForTestRun(
    baseUrl: string,
    jobId: string,
    timeout: number = 120000
): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds

    while (Date.now() - startTime < timeout) {
        const status = await getTestRunStatus(baseUrl, jobId);

        if (status.status === "completed") {
            return status.results;
        }

        if (status.status === "failed") {
            throw new Error(`Test run failed: ${status.error || "Unknown error"}`);
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Test run did not complete within ${timeout}ms`);
}

/**
 * Wait for improvement job to complete
 */
export async function waitForImprovement(
    baseUrl: string,
    jobId: string,
    timeout: number = 180000
): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 3000; // Poll every 3 seconds

    while (Date.now() - startTime < timeout) {
        const status = await getImprovementStatus(baseUrl, jobId);

        if (status.status === "completed") {
            return status;
        }

        if (status.status === "failed") {
            throw new Error(`Improvement job failed: ${status.error || "Unknown error"}`);
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Improvement job did not complete within ${timeout}ms`);
}

/**
 * Clear all data from the database (only works in test mode)
 */
export async function clearDatabase(baseUrl: string): Promise<void> {
    const response = await fetch(`${baseUrl}/api/test/clear`, {
        method: "DELETE",
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to clear database: ${error.error || response.statusText}`);
    }
}
