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
import { runTestsForPromptContent, getTestResultSummary, LLMTestResult, ModelRunner } from "./test-runner";
import { ConfigurationError, getErrorMessage, requireEntity } from "../errors";

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
    modelRunners: ModelRunner[],
    maxIterations: number,
    runsPerLlm: number
): Promise<void> {
    try {
        await runImprovement(jobId, prompt, testCases, modelRunners, maxIterations, runsPerLlm);
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

function getSavedModelRunners(): ModelRunner[] {
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
        "No models selected. Please select at least one model in settings before running improvements."
    );
}

export async function startImprovement(promptId: number, maxIterations: number, runsPerLlm: number = 1): Promise<string> {
    // Use OrFail variant for cleaner code - throws NotFoundError if prompt doesn't exist
    const prompt = getPromptByIdOrFail(promptId);

    const testCases = getTestCasesForPrompt(promptId);
    // Use requireEntity for explicit assertion with clear error message
    requireEntity(testCases.length > 0 ? testCases : null, `Test cases for prompt ${promptId}`);

    const modelRunners = getSavedModelRunners();
    if (modelRunners.length === 0) {
        throw new ConfigurationError("No LLM models selected. Please select at least one model in settings.");
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

    handleImprovementRun(jobId, prompt, testCases, modelRunners, maxIterations, runsPerLlm);

    return jobId;
}

async function runImprovement(
    jobId: string,
    prompt: Prompt,
    testCases: TestCase[],
    modelRunners: ModelRunner[],
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
    log(`Max iterations: ${maxIterations}`);
    log(`Runs per LLM: ${runsPerLlm}`);
    log(`Test cases: ${testCases.length}`);
    log(`Configured models: ${modelRunners.map((r) => r.displayName).join(", ")}`);

    log("Testing original prompt...");
    const originalResult = await runTestsForPromptContent(prompt.content, testCases, modelRunners, runsPerLlm);
    const originalScore = originalResult.score;

    progress.originalScore = originalScore;
    progress.bestScore = originalScore;
    progress.bestPromptContent = prompt.content;

    log(`Original prompt score: ${originalScore}%`);
    updateImprovementJob(jobId, {
        bestScore: originalScore,
        bestPromptContent: prompt.content,
    });

    if (originalScore === 100) {
        log("Original prompt already has perfect score! No improvement needed.");
        progress.status = "completed";
        updateImprovementJob(jobId, { status: "completed" });
        return;
    }

    let currentBestPrompt = prompt.content;
    let currentBestScore = originalScore;
    let currentTestResults = originalResult.results;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        progress.currentIteration = iteration;
        updateImprovementJob(jobId, { currentIteration: iteration });
        log(`\n--- Iteration ${iteration}/${maxIterations} ---`);

        const testSummary = getTestResultSummary(currentTestResults);

        log("Requesting improvements from all models...");
        const improvementPromises = modelRunners.map(async (runner) => {
            try {
                const improved = await runner.client.improvePrompt(currentBestPrompt, testSummary, runner.modelId);
                return { llm: runner.displayName, prompt: improved, error: null };
            } catch (error) {
                return { llm: runner.displayName, prompt: null, error: getErrorMessage(error) };
            }
        });

        const improvements = await Promise.all(improvementPromises);

        const improvementResults: Array<{
            llm: string;
            prompt: string;
            score: number;
            results: LLMTestResult[];
        }> = [];

        for (const improvement of improvements) {
            if (improvement.error || !improvement.prompt) {
                log(`${improvement.llm}: Failed to generate improvement - ${improvement.error}`);
                continue;
            }

            if (improvement.prompt.trim() === currentBestPrompt.trim()) {
                log(`${improvement.llm}: No changes proposed`);
                continue;
            }

            log(`Testing ${improvement.llm}'s improvement...`);
            try {
                const result = await runTestsForPromptContent(
                    improvement.prompt,
                    testCases,
                    modelRunners,
                    runsPerLlm
                );
                log(`${improvement.llm}: Score = ${result.score}% (was ${currentBestScore}%)`);

                improvementResults.push({
                    llm: improvement.llm,
                    prompt: improvement.prompt,
                    score: result.score,
                    results: result.results,
                });
            } catch (error) {
                log(`${improvement.llm}: Testing failed - ${getErrorMessage(error)}`);
            }
        }

        const bestImprovement = improvementResults
            .filter((r) => r.score > currentBestScore)
            .sort((a, b) => b.score - a.score)[0];

        if (bestImprovement) {
            log(
                `Best improvement this iteration: ${bestImprovement.llm} with score ${bestImprovement.score}%`
            );
            currentBestPrompt = bestImprovement.prompt;
            currentBestScore = bestImprovement.score;
            currentTestResults = bestImprovement.results;

            progress.bestScore = currentBestScore;
            progress.bestPromptContent = currentBestPrompt;
            updateImprovementJob(jobId, {
                bestScore: currentBestScore,
                bestPromptContent: currentBestPrompt,
            });

            if (currentBestScore === 100) {
                log("Perfect score achieved!");
                break;
            }
        } else {
            log("No improvement found this iteration");
            if (iteration < maxIterations) {
                log("Will try again with fresh perspective...");
            }
        }
    }

    if (currentBestScore > originalScore) {
        log(
            `\nImprovement complete! Score improved from ${originalScore}% to ${currentBestScore}%`
        );
        log("Saving improved prompt as new version...");

        const newPrompt = createPrompt(prompt.name, currentBestPrompt, prompt.id);
        log(`New version saved with id: ${newPrompt.id}, version: ${newPrompt.version}`);

        updateImprovementJob(jobId, { bestPromptVersionId: newPrompt.id });
    } else {
        log(
            `\nNo improvement achieved. Original score: ${originalScore}%, Best attempt: ${currentBestScore}%`
        );
    }

    progress.status = "completed";
    updateImprovementJob(jobId, { status: "completed" });
    log("Improvement job completed");
}
