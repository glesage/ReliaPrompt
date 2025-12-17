import {
    createImprovementJob,
    updateImprovementJob,
    appendImprovementLog,
    getPromptByIdOrFail,
    getTestCasesForPrompt,
    createPrompt,
    getConfig,
    Prompt,
    TestCase,
} from "../database";
import { getConfiguredClients, ModelSelection } from "../llm-clients";
import { runTests, getTestResultSummary, LLMTestResult, ModelRunner } from "./test-runner";
import { ConfigurationError, getErrorMessage, requireEntity } from "../errors";

export interface ChangeHistory {
    iteration: number;
    previousPrompt: string;
    newPrompt: string;
    changeSummary: string;
    improvedScore: boolean;
    resultingScore: number;
}

export interface ImprovementProgress {
    jobId: string;
    status: "pending" | "running" | "completed" | "failed";
    currentIteration: number;
    maxIterations: number;
    bestScore: number | null;
    bestPromptContent: string | null;
    originalScore: number | null;
    log: string[];
    error?: string;
}

const activeImprovementJobs = new Map<string, ImprovementProgress>();

export function getImprovementProgress(jobId: string): ImprovementProgress | null {
    return activeImprovementJobs.get(jobId) ?? null;
}

async function handleImprovementRun(
    jobId: string,
    prompt: Prompt,
    testCases: TestCase[],
    improvementRunner: ModelRunner,
    benchmarkRunners: ModelRunner[],
    maxIterations: number,
    runsPerLlm: number
): Promise<void> {
    try {
        await runImprovement(
            jobId,
            prompt,
            testCases,
            improvementRunner,
            benchmarkRunners,
            maxIterations,
            runsPerLlm
        );
    } catch (error) {
        const progress = activeImprovementJobs.get(jobId);
        if (progress) {
            progress.status = "failed";
            progress.error = error instanceof Error ? error.message : String(error);
            progress.log.push(`ERROR: ${progress.error}`);
        }
        updateImprovementJob(jobId, { status: "failed" });
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

function getModelRunnerFromSelection(selection: ModelSelection): ModelRunner {
    const clients = getConfiguredClients();
    const clientMap = new Map(clients.map((c) => [c.name, c]));
    const client = clientMap.get(selection.provider);

    if (!client) {
        throw new ConfigurationError(
            `Model ${selection.provider}/${selection.modelId} is not available. Please check your configuration.`
        );
    }

    return {
        client,
        modelId: selection.modelId,
        displayName: `${selection.provider} (${selection.modelId})`,
    };
}

function getSavedModelRunners(): ModelRunner[] {
    const savedModelsJson = getConfig("selected_models");
    if (savedModelsJson) {
        const savedModels = JSON.parse(savedModelsJson) as ModelSelection[];
        if (Array.isArray(savedModels) && savedModels.length > 0) {
            return getModelRunnersFromSelections(savedModels);
        }
    }

    throw new ConfigurationError(
        "No models selected. Please select at least one model in settings before running improvements."
    );
}

export async function startImprovement(
    promptId: number,
    maxIterations: number,
    runsPerLlm: number = 1,
    improvementModel: ModelSelection,
    benchmarkModels: ModelSelection[]
): Promise<string> {
    // Use OrFail variant for cleaner code - throws NotFoundError if prompt doesn't exist
    const prompt = getPromptByIdOrFail(promptId);

    const testCases = getTestCasesForPrompt(promptId);
    // Use requireEntity for explicit assertion with clear error message
    requireEntity(testCases.length > 0 ? testCases : null, `Test cases for prompt ${promptId}`);

    // Get improvement runner (single model)
    const improvementRunner = getModelRunnerFromSelection(improvementModel);

    // Get benchmark runners (all models for testing)
    const benchmarkRunners = getModelRunnersFromSelections(benchmarkModels);
    if (benchmarkRunners.length === 0) {
        throw new ConfigurationError(
            "No benchmark models selected. Please select at least one model for benchmarking."
        );
    }

    const jobId = crypto.randomUUID();
    createImprovementJob(jobId, promptId, maxIterations);

    const progress: ImprovementProgress = {
        jobId,
        status: "pending",
        currentIteration: 0,
        maxIterations,
        bestScore: null,
        bestPromptContent: null,
        originalScore: null,
        log: [],
    };
    activeImprovementJobs.set(jobId, progress);

    handleImprovementRun(
        jobId,
        prompt,
        testCases,
        improvementRunner,
        benchmarkRunners,
        maxIterations,
        runsPerLlm
    );

    return jobId;
}

async function runImprovement(
    jobId: string,
    prompt: Prompt,
    testCases: TestCase[],
    improvementRunner: ModelRunner,
    benchmarkRunners: ModelRunner[],
    maxIterations: number,
    runsPerLlm: number = 1
): Promise<void> {
    const progress = activeImprovementJobs.get(jobId)!;
    progress.status = "running";
    updateImprovementJob(jobId, { status: "running" });

    const log = (message: string) => {
        progress.log.push(message);
        appendImprovementLog(jobId, message);
    };

    log(`Starting improvement for prompt: "${prompt.name}" (id: ${prompt.id})`);
    log(`Improvement model: ${improvementRunner.displayName}`);
    log(`Benchmark models: ${benchmarkRunners.map((r) => r.displayName).join(", ")}`);

    const originalResult = await runTests(prompt.content, testCases, benchmarkRunners, runsPerLlm);
    const originalScore = originalResult.score;

    progress.originalScore = originalScore;
    progress.bestScore = originalScore;
    progress.bestPromptContent = prompt.content;

    log(
        `Original prompt score: ${(originalScore * 100).toFixed(1)}% (averaged across ${benchmarkRunners.length} benchmark model(s))`
    );
    updateImprovementJob(jobId, {
        bestScore: originalScore,
        bestPromptContent: prompt.content,
    });

    if (originalScore === 1) {
        log("Original prompt already has perfect score! No improvement needed.");
        progress.status = "completed";
        updateImprovementJob(jobId, { status: "completed" });
        return;
    }

    let currentBestPrompt = prompt.content;
    let currentBestScore = originalScore;
    let currentTestResults = originalResult.results;
    const changeHistory: ChangeHistory[] = [];

    // Helper function to generate a summary of changes between two prompts
    function generateChangeSummary(oldPrompt: string, newPrompt: string): string {
        const oldLines = oldPrompt.split("\n");
        const newLines = newPrompt.split("\n");

        const added: string[] = [];
        const removed: string[] = [];

        // Simple line-by-line comparison
        const oldSet = new Set(oldLines.map((l) => l.trim()));
        const newSet = new Set(newLines.map((l) => l.trim()));

        for (const line of newLines) {
            const trimmed = line.trim();
            if (trimmed && !oldSet.has(trimmed)) {
                added.push(trimmed);
            }
        }

        for (const line of oldLines) {
            const trimmed = line.trim();
            if (trimmed && !newSet.has(trimmed)) {
                removed.push(trimmed);
            }
        }

        const changes: string[] = [];
        if (added.length > 0) {
            const addedPreview = added
                .slice(0, 3)
                .map((l) => (l.length > 50 ? l.substring(0, 50) + "..." : l))
                .join("; ");
            changes.push(
                `Added: ${addedPreview}${added.length > 3 ? ` (and ${added.length - 3} more)` : ""}`
            );
        }
        if (removed.length > 0) {
            const removedPreview = removed
                .slice(0, 3)
                .map((l) => (l.length > 50 ? l.substring(0, 50) + "..." : l))
                .join("; ");
            changes.push(
                `Removed: ${removedPreview}${removed.length > 3 ? ` (and ${removed.length - 3} more)` : ""}`
            );
        }

        if (changes.length === 0) {
            return "Minor formatting or whitespace changes";
        }

        return changes.join(" | ");
    }

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        progress.currentIteration = iteration;
        updateImprovementJob(jobId, { currentIteration: iteration });
        log(`\n--- Iteration ${iteration}/${maxIterations} ---`);

        const testSummary = getTestResultSummary(currentTestResults);

        // Use only the improvement runner to generate improvements
        let improvedPrompt: string | null = null;
        let improvementError: string | null = null;

        try {
            log(`Requesting improvement from ${improvementRunner.displayName}...`);
            improvedPrompt = await improvementRunner.client.improvePrompt(
                currentBestPrompt,
                testSummary,
                improvementRunner.modelId,
                changeHistory
            );
        } catch (error) {
            improvementError = getErrorMessage(error);
            log(
                `${improvementRunner.displayName}: Failed to generate improvement - ${improvementError}`
            );
        }

        if (improvementError || !improvedPrompt) {
            log("Skipping this iteration due to improvement generation failure");
            if (iteration < maxIterations) {
                log("Will try again with fresh perspective...");
            }
            continue;
        }

        if (improvedPrompt.trim() === currentBestPrompt.trim()) {
            log(`${improvementRunner.displayName}: No changes proposed`);
            if (iteration < maxIterations) {
                log("Will try again with fresh perspective...");
            }
            continue;
        }

        // Test the improved prompt against all benchmark models
        try {
            log(`Testing improved prompt against ${benchmarkRunners.length} benchmark model(s)...`);
            const result = await runTests(improvedPrompt, testCases, benchmarkRunners, runsPerLlm);
            log(
                `Improved prompt score: ${(result.score * 100).toFixed(1)}% (was ${(currentBestScore * 100).toFixed(1)}%)`
            );

            const improved = result.score > currentBestScore;
            const changeSummary = generateChangeSummary(currentBestPrompt, improvedPrompt);

            // Record this change attempt in history
            changeHistory.push({
                iteration,
                previousPrompt: currentBestPrompt,
                newPrompt: improvedPrompt,
                changeSummary,
                improvedScore: improved,
                resultingScore: result.score,
            });

            if (improved) {
                log(
                    `✓ Improvement found! Score increased by ${((result.score - currentBestScore) * 100).toFixed(1)}%`
                );
                currentBestPrompt = improvedPrompt;
                currentBestScore = result.score;
                currentTestResults = result.results;

                progress.bestScore = currentBestScore;
                progress.bestPromptContent = currentBestPrompt;
                updateImprovementJob(jobId, {
                    bestScore: currentBestScore,
                    bestPromptContent: currentBestPrompt,
                });

                if (currentBestScore === 1) {
                    log("Perfect score achieved!");
                    break;
                }
            } else {
                log(`✗ No improvement (score did not increase)`);
                if (iteration < maxIterations) {
                    log("Will try again with fresh perspective...");
                }
            }
        } catch (error) {
            log(`Testing failed - ${getErrorMessage(error)}`);
            if (iteration < maxIterations) {
                log("Will try again with fresh perspective...");
            }
        }
    }

    if (currentBestScore > originalScore) {
        log(
            `\nImprovement complete! Score improved from ${(originalScore * 100).toFixed(1)}% to ${(currentBestScore * 100).toFixed(1)}%`
        );
        log("Saving improved prompt as new version...");

        const newPrompt = createPrompt(prompt.name, currentBestPrompt, prompt.id);
        log(`New version saved with id: ${newPrompt.id}, version: ${newPrompt.version}`);

        updateImprovementJob(jobId, { bestPromptVersionId: newPrompt.id });
    } else {
        log(
            `\nNo improvement achieved. Original score: ${(originalScore * 100).toFixed(1)}%, Best attempt: ${(currentBestScore * 100).toFixed(1)}%`
        );
    }

    progress.status = "completed";
    updateImprovementJob(jobId, { status: "completed" });
    log("Improvement job completed");
}
