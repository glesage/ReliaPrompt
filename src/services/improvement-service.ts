import {
    createImprovementJob,
    updateImprovementJob,
    appendImprovementLog,
    getPromptByIdOrFail,
    getTestCasesForPrompt,
    createPrompt,
    Prompt,
    TestCase,
} from "../database";
import { getConfiguredClients, LLMClient } from "../llm-clients";
import { runTestsForPromptContent, getTestResultSummary, LLMTestResult } from "./test-runner";
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
    clients: LLMClient[],
    maxIterations: number
): Promise<void> {
    try {
        await runImprovement(jobId, prompt, testCases, clients, maxIterations);
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

export async function startImprovement(promptId: number, maxIterations: number): Promise<string> {
    // Use OrFail variant for cleaner code - throws NotFoundError if prompt doesn't exist
    const prompt = getPromptByIdOrFail(promptId);

    const testCases = getTestCasesForPrompt(promptId);
    // Use requireEntity for explicit assertion with clear error message
    requireEntity(
        testCases.length > 0 ? testCases : null,
        `Test cases for prompt ${promptId}`
    );

    const clients = getConfiguredClients();
    if (clients.length === 0) {
        throw new ConfigurationError("No LLM providers configured");
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

    handleImprovementRun(jobId, prompt, testCases, clients, maxIterations);

    return jobId;
}

async function runImprovement(
    jobId: string,
    prompt: Prompt,
    testCases: TestCase[],
    clients: LLMClient[],
    maxIterations: number
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
    log(`Test cases: ${testCases.length}`);
    log(`Configured LLMs: ${clients.map((c) => c.name).join(", ")}`);

    log("Testing original prompt...");
    const originalResult = await runTestsForPromptContent(prompt.content, testCases, clients);
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

        log("Requesting improvements from all LLMs...");
        const improvementPromises = clients.map(async (client) => {
            try {
                const improved = await client.improvePrompt(currentBestPrompt, testSummary);
                return { llm: client.name, prompt: improved, error: null };
            } catch (error) {
                return { llm: client.name, prompt: null, error: getErrorMessage(error) };
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
                    clients
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
