import {
    createTestJob,
    updateTestJob,
    createTestResult,
    getTestCasesForPrompt,
    getPromptByIdOrFail,
    getConfig,
    TestCase,
    Prompt,
} from "../database";
import { getConfiguredClients, ModelSelection, LLMClient } from "../llm-clients";
import { compareJSON } from "../utils/json-comparison";
import { ConfigurationError, getErrorMessage, requireEntity } from "../errors";

// Represents a model to run tests against
export interface ModelRunner {
    client: LLMClient;
    modelId: string;
    displayName: string; // e.g., "OpenAI (gpt-4o)"
}

const DEFAULT_RUNS_PER_TEST = 1;

export interface TestProgress {
    jobId: string;
    status: "pending" | "running" | "completed" | "failed";
    totalTests: number;
    completedTests: number;
    progress: number; // 0-100
    results?: TestResults;
    error?: string;
}

export interface TestResults {
    promptId: number;
    promptContent: string;
    totalTestCases: number;
    llmResults: LLMTestResult[];
    overallScore: number;
}

export interface LLMTestResult {
    llmName: string;
    correctCount: number;
    totalRuns: number;
    score: number; // 0-100
    testCaseResults: TestCaseResult[];
    durationStats?: {
        minMs: number;
        maxMs: number;
        avgMs: number;
    };
}

export interface TestCaseResult {
    testCaseId: number;
    input: string;
    expectedOutput: string;
    runs: RunResult[];
    correctRuns: number;
}

export interface RunResult {
    runNumber: number;
    actualOutput: string | null;
    isCorrect: boolean;
    error?: string;
    durationMs?: number;
}

const activeJobs = new Map<string, TestProgress>();

export function getTestProgress(jobId: string): TestProgress | null {
    return activeJobs.get(jobId) ?? null;
}

async function handleTestRun(
    jobId: string,
    prompt: Prompt,
    testCases: TestCase[],
    modelRunners: ModelRunner[],
    runsPerTest: number
): Promise<void> {
    try {
        await runTests(jobId, prompt, testCases, modelRunners, runsPerTest);
    } catch (error) {
        const progress = activeJobs.get(jobId);
        if (progress) {
            progress.status = "failed";
            progress.error = error instanceof Error ? error.message : String(error);
        }
        updateTestJob(jobId, { status: "failed" });
    }
}

function getModelRunnersFromSelections(selectedModels: ModelSelection[]): ModelRunner[] {
    const clients = getConfiguredClients();
    const clientMap = new Map(clients.map((c) => [c.name, c]));
    const runners: ModelRunner[] = [];

    for (const selection of selectedModels) {
        const client = clientMap.get(selection.provider);
        if (client) {
            runners.push({
                client,
                modelId: selection.modelId,
                displayName: `${selection.provider} (${selection.modelId})`,
            });
        }
    }

    return runners;
}

function getSavedModelRunners(): ModelRunner[] {
    // Check for saved selected_models in config
    const savedModelsJson = getConfig("selected_models");
    if (savedModelsJson) {
        try {
            const savedModels = JSON.parse(savedModelsJson) as ModelSelection[];
            if (Array.isArray(savedModels) && savedModels.length > 0) {
                return getModelRunnersFromSelections(savedModels);
            }
        } catch {
            // Fall through to throw error
        }
    }

    throw new ConfigurationError(
        "No models selected. Please select at least one model in settings before running tests."
    );
}

export async function startTestRun(
    promptId: number,
    runsPerTest: number = DEFAULT_RUNS_PER_TEST,
    selectedModels?: ModelSelection[]
): Promise<string> {
    // Use OrFail variant - throws NotFoundError if prompt doesn't exist
    const prompt = getPromptByIdOrFail(promptId);

    const testCases = getTestCasesForPrompt(promptId);
    // Use requireEntity for explicit assertion with clear error message
    requireEntity(testCases.length > 0 ? testCases : null, `Test cases for prompt ${promptId}`);

    // Get model runners based on selection or saved settings
    const modelRunners = selectedModels && selectedModels.length > 0
        ? getModelRunnersFromSelections(selectedModels)
        : getSavedModelRunners();

    if (modelRunners.length === 0) {
        throw new ConfigurationError(
            "No LLM models selected. Please select at least one model to run tests."
        );
    }

    const jobId = crypto.randomUUID();
    const totalTests = testCases.length * modelRunners.length * runsPerTest;

    createTestJob(jobId, promptId, totalTests);

    const progress: TestProgress = {
        jobId,
        status: "pending",
        totalTests,
        completedTests: 0,
        progress: 0,
    };
    activeJobs.set(jobId, progress);

    handleTestRun(jobId, prompt, testCases, modelRunners, runsPerTest);

    return jobId;
}

async function runTests(
    jobId: string,
    prompt: Prompt,
    testCases: TestCase[],
    modelRunners: ModelRunner[],
    runsPerTest: number = DEFAULT_RUNS_PER_TEST
): Promise<void> {
    const progress = activeJobs.get(jobId)!;
    progress.status = "running";
    updateTestJob(jobId, { status: "running" });

    const llmResults: LLMTestResult[] = [];
    let completedTests = 0;

    const llmPromises = modelRunners.map(async (runner) => {
        const testCaseResults: TestCaseResult[] = [];
        let llmCorrectCount = 0;
        let llmTotalRuns = 0;

        const testCasePromises = testCases.map(async (testCase) => {
            const runs: RunResult[] = [];
            let correctRuns = 0;

            for (let runNumber = 1; runNumber <= runsPerTest; runNumber++) {
                try {
                    const startTime = Date.now();
                    const actualOutput = await runner.client.complete(prompt.content, testCase.input, runner.modelId);
                    const durationMs = Date.now() - startTime;
                    const comparison = compareJSON(testCase.expectedOutput, actualOutput);

                    const isCorrect = comparison.isEqual;
                    if (isCorrect) {
                        correctRuns++;
                        llmCorrectCount++;
                    }
                    llmTotalRuns++;

                    runs.push({
                        runNumber,
                        actualOutput,
                        isCorrect,
                        error: comparison.error,
                        durationMs,
                    });

                    createTestResult(
                        jobId,
                        testCase.id,
                        runner.displayName,
                        runNumber,
                        actualOutput,
                        isCorrect,
                        comparison.error,
                        durationMs
                    );
                } catch (error) {
                    llmTotalRuns++;
                    const errorMessage = getErrorMessage(error);
                    runs.push({
                        runNumber,
                        actualOutput: null,
                        isCorrect: false,
                        error: errorMessage,
                    });

                    createTestResult(
                        jobId,
                        testCase.id,
                        runner.displayName,
                        runNumber,
                        null,
                        false,
                        errorMessage
                    );
                }

                completedTests++;
                progress.completedTests = completedTests;
                progress.progress = Math.round((completedTests / progress.totalTests) * 100);
                updateTestJob(jobId, { completedTests: completedTests });
            }

            return {
                testCaseId: testCase.id,
                input: testCase.input,
                expectedOutput: testCase.expectedOutput,
                runs,
                correctRuns,
            } as TestCaseResult;
        });

        const results = await Promise.all(testCasePromises);
        testCaseResults.push(...results);

        // Calculate duration stats from all runs
        const allDurations = testCaseResults.flatMap(tc => 
            tc.runs.map(r => r.durationMs).filter((d): d is number => d !== undefined)
        );
        const durationStats = allDurations.length > 0 ? {
            minMs: Math.min(...allDurations),
            maxMs: Math.max(...allDurations),
            avgMs: Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length),
        } : undefined;

        return {
            llmName: runner.displayName,
            correctCount: llmCorrectCount,
            totalRuns: llmTotalRuns,
            score: llmTotalRuns > 0 ? Math.round((llmCorrectCount / llmTotalRuns) * 100) : 0,
            testCaseResults,
            durationStats,
        } as LLMTestResult;
    });

    const results = await Promise.all(llmPromises);
    llmResults.push(...results);

    const totalCorrect = llmResults.reduce((sum, r) => sum + r.correctCount, 0);
    const totalRuns = llmResults.reduce((sum, r) => sum + r.totalRuns, 0);
    const overallScore = totalRuns > 0 ? Math.round((totalCorrect / totalRuns) * 100) : 0;

    const testResults: TestResults = {
        promptId: prompt.id,
        promptContent: prompt.content,
        totalTestCases: testCases.length,
        llmResults,
        overallScore,
    };

    progress.status = "completed";
    progress.results = testResults;
    updateTestJob(jobId, {
        status: "completed",
        results: JSON.stringify(testResults),
    });
}

export async function runTestsForPromptContent(
    promptContent: string,
    testCases: TestCase[],
    modelRunners: ModelRunner[],
    runsPerTest: number = DEFAULT_RUNS_PER_TEST
): Promise<{ score: number; results: LLMTestResult[] }> {
    const llmResults: LLMTestResult[] = [];

    const llmPromises = modelRunners.map(async (runner) => {
        const testCaseResults: TestCaseResult[] = [];
        let llmCorrectCount = 0;
        let llmTotalRuns = 0;

        const testCasePromises = testCases.map(async (testCase) => {
            const runs: RunResult[] = [];
            let correctRuns = 0;

            for (let runNumber = 1; runNumber <= runsPerTest; runNumber++) {
                try {
                    const startTime = Date.now();
                    const actualOutput = await runner.client.complete(promptContent, testCase.input, runner.modelId);
                    const durationMs = Date.now() - startTime;
                    const comparison = compareJSON(testCase.expectedOutput, actualOutput);

                    const isCorrect = comparison.isEqual;
                    if (isCorrect) {
                        correctRuns++;
                        llmCorrectCount++;
                    }
                    llmTotalRuns++;

                    runs.push({
                        runNumber,
                        actualOutput,
                        isCorrect,
                        error: comparison.error,
                        durationMs,
                    });
                } catch (error) {
                    llmTotalRuns++;
                    runs.push({
                        runNumber,
                        actualOutput: null,
                        isCorrect: false,
                        error: getErrorMessage(error),
                    });
                }
            }

            return {
                testCaseId: testCase.id,
                input: testCase.input,
                expectedOutput: testCase.expectedOutput,
                runs,
                correctRuns,
            } as TestCaseResult;
        });

        const results = await Promise.all(testCasePromises);
        testCaseResults.push(...results);

        // Calculate duration stats from all runs
        const allDurations = testCaseResults.flatMap(tc => 
            tc.runs.map(r => r.durationMs).filter((d): d is number => d !== undefined)
        );
        const durationStats = allDurations.length > 0 ? {
            minMs: Math.min(...allDurations),
            maxMs: Math.max(...allDurations),
            avgMs: Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length),
        } : undefined;

        return {
            llmName: runner.displayName,
            correctCount: llmCorrectCount,
            totalRuns: llmTotalRuns,
            score: llmTotalRuns > 0 ? Math.round((llmCorrectCount / llmTotalRuns) * 100) : 0,
            testCaseResults,
            durationStats,
        } as LLMTestResult;
    });

    const results = await Promise.all(llmPromises);
    llmResults.push(...results);

    const totalCorrect = llmResults.reduce((sum, r) => sum + r.correctCount, 0);
    const totalRuns = llmResults.reduce((sum, r) => sum + r.totalRuns, 0);
    const score = totalRuns > 0 ? Math.round((totalCorrect / totalRuns) * 100) : 0;

    return { score, results: llmResults };
}

export function getTestResultSummary(results: LLMTestResult[]) {
    const summary: Array<{
        input: string;
        expectedOutput: string;
        actualOutput: string | null;
        isCorrect: boolean;
        error?: string;
    }> = [];

    const testCaseMap = new Map<
        number,
        {
            input: string;
            expectedOutput: string;
            outputs: Array<{ output: string | null; isCorrect: boolean; error?: string }>;
        }
    >();

    for (const llmResult of results) {
        for (const tcResult of llmResult.testCaseResults) {
            if (!testCaseMap.has(tcResult.testCaseId)) {
                testCaseMap.set(tcResult.testCaseId, {
                    input: tcResult.input,
                    expectedOutput: tcResult.expectedOutput,
                    outputs: [],
                });
            }

            const tc = testCaseMap.get(tcResult.testCaseId)!;
            for (const run of tcResult.runs) {
                tc.outputs.push({
                    output: run.actualOutput,
                    isCorrect: run.isCorrect,
                    error: run.error,
                });
            }
        }
    }

    for (const [, tc] of testCaseMap) {
        const wrongOutputs = tc.outputs.filter((o) => !o.isCorrect);
        const anyCorrect = tc.outputs.some((o) => o.isCorrect);

        if (wrongOutputs.length > 0) {
            const representative = wrongOutputs[0];
            summary.push({
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                actualOutput: representative.output,
                isCorrect: false,
                error: representative.error,
            });
        } else if (anyCorrect) {
            const correct = tc.outputs.find((o) => o.isCorrect)!;
            summary.push({
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                actualOutput: correct.output,
                isCorrect: true,
            });
        }
    }

    return summary;
}
