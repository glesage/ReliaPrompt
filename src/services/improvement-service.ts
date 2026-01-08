import {
    createImprovementJob,
    updateImprovementJob,
    appendImprovementLog,
    getPromptByIdOrFail,
    getTestCasesForPrompt,
    createPrompt,
    createSuggestions,
    getSuggestionsForJob,
    markSuggestionsAsApplied,
    markSuggestionsAsUndone,
    getSuggestionById,
    Prompt,
    TestCase,
    Suggestion,
} from "../database";
import { getConfiguredClients, ModelSelection } from "../llm-clients";
import { runTests, LLMTestResult, ModelRunner } from "./test-runner";
import { ConfigurationError, getErrorMessage, requireEntity } from "../errors";
import {
    analyzeFailures,
    analyzeSuggestions,
    makeDecision,
    generateUndoPrompt,
    proposeSuggestions,
    implementSuggestions,
    getAverageDuration,
    FailureSummary,
    SuggestionSummary,
    AgentRunner,
    TimingMetrics,
} from "./agents";

// Legacy type - kept for backwards compatibility with LLM client improvePrompt method
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

    // Create agent runner from improvement runner
    const agentRunner: AgentRunner = {
        client: improvementRunner.client,
        modelId: improvementRunner.modelId,
    };

    log(`Starting multi-agent improvement for prompt: "${prompt.name}" (id: ${prompt.id})`);
    log(`Improvement model: ${improvementRunner.displayName}`);
    log(`Benchmark models: ${benchmarkRunners.map((r) => r.displayName).join(", ")}`);

    // Run initial tests
    const originalResult = await runTests(prompt.content, testCases, benchmarkRunners, runsPerLlm);
    const originalScore = originalResult.score;
    const originalDurationMs = getAverageDuration(originalResult.results);

    progress.originalScore = originalScore;
    progress.bestScore = originalScore;
    progress.bestPromptContent = prompt.content;

    log(
        `Original prompt score: ${(originalScore * 100).toFixed(1)}% (averaged across ${benchmarkRunners.length} benchmark model(s))`
    );
    log(`Original prompt length: ${prompt.content.length} chars, avg duration: ${originalDurationMs}ms`);
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

    let currentPrompt = prompt.content;
    let currentScore = originalScore;
    let previousScore = originalScore;
    let currentDurationMs = originalDurationMs;
    let previousDurationMs = originalDurationMs;
    let bestDurationMs = originalDurationMs;
    let currentTestResults: LLMTestResult[] = originalResult.results;
    const originalPrompt = prompt.content;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        progress.currentIteration = iteration;
        updateImprovementJob(jobId, { currentIteration: iteration });
        log(`\n--- Iteration ${iteration}/${maxIterations} ---`);

        try {
            // Step 1: Run tests (already done for first iteration, or after previous changes)
            if (iteration > 1) {
                log(`Testing current prompt...`);
                const testResult = await runTests(
                    currentPrompt,
                    testCases,
                    benchmarkRunners,
                    runsPerLlm
                );
                previousScore = currentScore;
                previousDurationMs = currentDurationMs;
                currentScore = testResult.score;
                currentDurationMs = getAverageDuration(testResult.results);
                currentTestResults = testResult.results;
                log(`Current score: ${(currentScore * 100).toFixed(1)}%, duration: ${currentDurationMs}ms`);

                if (currentScore === 1) {
                    log("Perfect score achieved!");
                    break;
                }
            }

            // Step 2: Parallel Analysis - Run Failure Analyzer and Suggestion Analyzer concurrently
            log(`Running parallel analysis (Failure Analyzer + Suggestion Analyzer)...`);
            const suggestionHistory = getSuggestionsForJob(jobId);

            let failureSummary: FailureSummary;
            let suggestionSummary: SuggestionSummary;

            try {
                const [failureResult, suggestionResult] = await Promise.all([
                    analyzeFailures(agentRunner, currentTestResults),
                    analyzeSuggestions(agentRunner, suggestionHistory),
                ]);
                failureSummary = failureResult;
                suggestionSummary = suggestionResult;
            } catch (error) {
                log(`Analysis failed: ${getErrorMessage(error)}`);
                log("Skipping this iteration due to analysis failure");
                continue;
            }

            log(
                `Failure Analysis: ${failureSummary.failedTests}/${failureSummary.totalTests} tests failed`
            );
            log(`Failure patterns identified: ${failureSummary.failurePatterns.length}`);
            log(
                `Suggestion history: ${suggestionSummary.totalSuggestions} total, ${suggestionSummary.appliedCount} applied`
            );

            // Step 3: Decision Agent - Decide whether to undo or continue
            log(`Running Decision Agent...`);
            const timing: TimingMetrics = {
                currentDurationMs,
                previousDurationMs,
                originalDurationMs,
            };
            let decision;
            try {
                decision = await makeDecision(
                    agentRunner,
                    currentScore,
                    previousScore,
                    failureSummary,
                    suggestionSummary,
                    suggestionHistory,
                    timing
                );
            } catch (error) {
                log(`Decision Agent failed: ${getErrorMessage(error)}`);
                log("Defaulting to 'continue' action");
                decision = {
                    action: "continue" as const,
                    rationale: "Decision agent failed, defaulting to continue",
                    confidence: 0.5,
                };
            }

            log(
                `Decision: ${decision.action.toUpperCase()} (confidence: ${(decision.confidence * 100).toFixed(0)}%)`
            );
            log(`Rationale: ${decision.rationale}`);

            let newPrompt: string;

            if (
                decision.action === "undo" &&
                decision.suggestionIdsToUndo &&
                decision.suggestionIdsToUndo.length > 0
            ) {
                // Step 4a: Undo Agent - Generate prompt reversing changes
                log(
                    `Running Undo Agent to reverse ${decision.suggestionIdsToUndo.length} suggestion(s)...`
                );

                const suggestionsToUndo: Suggestion[] = decision.suggestionIdsToUndo
                    .map((id) => getSuggestionById(id))
                    .filter((s): s is Suggestion => s !== null);

                if (suggestionsToUndo.length === 0) {
                    log("No valid suggestions to undo, falling back to continue action");
                    decision.action = "continue";
                } else {
                    try {
                        newPrompt = await generateUndoPrompt(
                            agentRunner,
                            currentPrompt,
                            originalPrompt,
                            suggestionsToUndo,
                            decision.undoRationale ?? decision.rationale
                        );

                        // Mark suggestions as undone
                        markSuggestionsAsUndone(decision.suggestionIdsToUndo);
                        log(
                            `Marked ${decision.suggestionIdsToUndo.length} suggestion(s) as undone`
                        );

                        currentPrompt = newPrompt;
                        log(`Generated revised prompt after undo`);

                        // Update best if score improves (will be tested next iteration)
                        progress.bestPromptContent = currentPrompt;
                        updateImprovementJob(jobId, { bestPromptContent: currentPrompt });
                        continue;
                    } catch (error) {
                        log(`Undo Agent failed: ${getErrorMessage(error)}`);
                        log("Falling back to continue action");
                        decision.action = "continue";
                    }
                }
            }

            if (decision.action === "continue") {
                // Step 4b: Suggestion Agent - Propose new suggestions
                log(`Running Suggestion Agent...`);
                let proposedSuggestions;
                try {
                    proposedSuggestions = await proposeSuggestions(
                        agentRunner,
                        currentPrompt,
                        failureSummary,
                        suggestionSummary
                    );
                } catch (error) {
                    log(`Suggestion Agent failed: ${getErrorMessage(error)}`);
                    log("Skipping this iteration");
                    continue;
                }

                if (proposedSuggestions.length === 0) {
                    log("No suggestions proposed, skipping this iteration");
                    continue;
                }

                log(`Proposed ${proposedSuggestions.length} suggestion(s):`);
                for (const s of proposedSuggestions) {
                    log(`  - [${s.priority}] ${s.content.substring(0, 100)}...`);
                }

                // Store suggestions in database
                const storedSuggestions = createSuggestions(
                    jobId,
                    iteration,
                    proposedSuggestions.map((s) => ({
                        content: s.content,
                        rationale: s.rationale,
                    }))
                );
                log(`Stored ${storedSuggestions.length} suggestion(s) in database`);

                // Step 5: Implement Agent - Apply suggestions to create new prompt
                log(`Running Implement Agent...`);
                try {
                    newPrompt = await implementSuggestions(
                        agentRunner,
                        currentPrompt,
                        proposedSuggestions
                    );
                } catch (error) {
                    log(`Implement Agent failed: ${getErrorMessage(error)}`);
                    log("Skipping this iteration");
                    continue;
                }

                if (newPrompt.trim() === currentPrompt.trim()) {
                    log("No changes made to prompt, skipping this iteration");
                    continue;
                }

                // Mark suggestions as applied
                const suggestionIds = storedSuggestions.map((s) => s.id);
                markSuggestionsAsApplied(suggestionIds);
                log(`Marked ${suggestionIds.length} suggestion(s) as applied`);

                currentPrompt = newPrompt;
                log(`Generated improved prompt`);

                // Test the new prompt immediately
                log(`Testing improved prompt...`);
                const testResult = await runTests(
                    currentPrompt,
                    testCases,
                    benchmarkRunners,
                    runsPerLlm
                );
                const newScore = testResult.score;
                const newDurationMs = getAverageDuration(testResult.results);
                const newPromptLength = currentPrompt.length;
                log(
                    `New score: ${(newScore * 100).toFixed(1)}% (was ${(currentScore * 100).toFixed(1)}%)`
                );
                log(
                    `New duration: ${newDurationMs}ms (was ${currentDurationMs}ms), prompt length: ${newPromptLength} chars`
                );

                // Evaluate improvement considering both score and timing
                // An improvement must have better score, or same score with better/equal speed
                const scoreImproved = newScore > progress.bestScore!;
                const scoreSame = Math.abs(newScore - progress.bestScore!) < 0.001;
                const speedImproved = newDurationMs < bestDurationMs;
                const speedAcceptable = newDurationMs <= bestDurationMs * 1.2; // Allow up to 20% slowdown for better score

                const isImprovement = scoreImproved && speedAcceptable;
                const isSidegrade = scoreSame && speedImproved; // Same score but faster

                if (isImprovement || isSidegrade) {
                    if (isImprovement) {
                        log(
                            `✓ Improvement found! Score: +${((newScore - progress.bestScore!) * 100).toFixed(1)}%`
                        );
                    } else {
                        log(
                            `✓ Speed improvement found! Duration: ${bestDurationMs}ms → ${newDurationMs}ms (same score)`
                        );
                    }
                    progress.bestScore = newScore;
                    progress.bestPromptContent = currentPrompt;
                    bestDurationMs = newDurationMs;
                    updateImprovementJob(jobId, {
                        bestScore: newScore,
                        bestPromptContent: currentPrompt,
                    });
                } else if (scoreImproved && !speedAcceptable) {
                    log(
                        `✗ Score improved but prompt is too slow (${newDurationMs}ms vs ${bestDurationMs}ms baseline)`
                    );
                } else {
                    log(
                        `✗ No improvement over best score (${(progress.bestScore! * 100).toFixed(1)}%)`
                    );
                }

                previousScore = currentScore;
                previousDurationMs = currentDurationMs;
                currentScore = newScore;
                currentDurationMs = newDurationMs;
                currentTestResults = testResult.results;

                if (currentScore === 1) {
                    log("Perfect score achieved!");
                    break;
                }
            }
        } catch (error) {
            log(`Iteration failed: ${getErrorMessage(error)}`);
            log("Will try again in next iteration...");
        }
    }

    // Final summary
    if (progress.bestScore! > originalScore) {
        log(
            `\nImprovement complete! Score improved from ${(originalScore * 100).toFixed(1)}% to ${(progress.bestScore! * 100).toFixed(1)}%`
        );
        log("Saving improved prompt as new version...");

        const newPrompt = createPrompt(prompt.name, progress.bestPromptContent!, prompt.id);
        log(`New version saved with id: ${newPrompt.id}, version: ${newPrompt.version}`);

        updateImprovementJob(jobId, { bestPromptVersionId: newPrompt.id });
    } else {
        log(
            `\nNo improvement achieved. Original score: ${(originalScore * 100).toFixed(1)}%, Best attempt: ${(progress.bestScore! * 100).toFixed(1)}%`
        );
    }

    progress.status = "completed";
    updateImprovementJob(jobId, { status: "completed" });
    log("Improvement job completed");
}
