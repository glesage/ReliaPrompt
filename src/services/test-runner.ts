import {
    createTestJob,
    updateTestJob,
    createTestResult,
    getTestCasesForPrompt,
    getPromptByIdOrFail,
    getConfig,
    TestCase,
    Prompt,
    TestResult as DbTestResult,
} from "../database";
import { getConfiguredClients, ModelSelection, LLMClient } from "../llm-clients";
import { compare } from "../utils/compare";
import { parse, ParseType } from "../utils/parse";
import { ConfigurationError, getErrorMessage, requireEntity } from "../errors";

// Represents a model to run tests against
export interface ModelRunner {
    client: LLMClient;
    modelId: string;
    displayName: string; // e.g., "OpenAI (gpt-4o)"
}

const DEFAULT_RUNS_PER_TEST = 1;
const DEFAULT_EVALUATION_MODEL: ModelSelection = {
    provider: "OpenAI",
    modelId: "gpt-5.2",
};

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
    evaluationModel?: ModelSelection;
    llmResults: LLMTestResult[];
    overallScore: number;
}

export interface LLMTestResult {
    llmName: string;
    correctCount: number;
    totalRuns: number;
    score: number; // 0-1 average score across all runs
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
    averageScore: number; // Average score across all runs for this test case
}

/**
 * Represents a single evaluation issue with structured information.
 */
export interface EvaluationIssue {
    substring: string;
    explanation: string;
}

/**
 * Base type containing common fields shared across test result types.
 * Used by RunResult, TestResultSummary, and database TestResult.
 */
export interface BaseTestResult {
    actualOutput: string | null;
    isCorrect: boolean;
    score: number; // 0-1 score
    expectedFound: number;
    expectedTotal: number;
    unexpectedFound: number;
    issues?: EvaluationIssue[];
    error?: string;
    durationMs?: number;
    reason?: string; // LLM evaluation reason (when using LLM evaluation mode)
}

export interface RunResult extends BaseTestResult {
    runNumber: number;
}

const activeJobs = new Map<string, TestProgress>();

export function getTestProgress(jobId: string): TestProgress | null {
    return activeJobs.get(jobId) ?? null;
}

/**
 * Computes the deduction for a single issue using the deterministic formula:
 * deduction = max(0.2, (-0.2667 * substringLength) + 1.2667)
 * Uses trimmed substring character length, not word count.
 */
function computeIssueDeduction(issue: EvaluationIssue): number {
    const substringLength = issue.substring.trim().length;
    const deduction = Math.max(0.2, -0.2667 * substringLength + 1.2667);
    return deduction;
}

/**
 * Deduplicates issues by normalized key (substring+explanation, trimmed and lowercase).
 */
function deduplicateIssues(issues: EvaluationIssue[]): EvaluationIssue[] {
    const uniqueIssues = new Map<string, EvaluationIssue>();

    for (const issue of issues) {
        const normalizedSubstring = issue.substring.trim().toLowerCase();
        const normalizedExplanation = issue.explanation.trim().toLowerCase();
        const key = `${normalizedSubstring}|||${normalizedExplanation}`;

        if (!uniqueIssues.has(key)) {
            uniqueIssues.set(key, issue);
        }
    }

    return [...uniqueIssues.values()];
}

/**
 * Deterministic linear equation for quality scoring using issue substring character length.
 * score = clamp(1 - Σ(deduction per normalized issue), 0, 1)
 */
function calculateScoreFromIssues(issues: EvaluationIssue[]): number {
    const normalizedIssues = deduplicateIssues(issues);
    const totalDeduction = normalizedIssues.reduce((total, issue) => {
        return total + computeIssueDeduction(issue);
    }, 0);

    const score = 1 - totalDeduction;
    return Math.max(0, Math.min(1, Number(score.toFixed(6))));
}

/**
 * Calls the selected judge model to evaluate an AI output based on evaluation criteria.
 * Returns structured issues; score is computed deterministically from issues.
 */
async function evaluateWithLLMJudge(
    promptContent: string,
    testCaseInput: string,
    actualOutput: string,
    evaluationCriteria: string,
    evaluationModelRunner: ModelRunner
): Promise<{ issues: EvaluationIssue[] }> {
    const judgePrompt = `Your task is to evaluate the quality of the AI-generated output based on the criteria.

## Task that was done
\`\`\`
${promptContent}
\`\`\`

## Task input
\`\`\`
${testCaseInput}
\`\`\`

## Your evaluation criteria
\`\`\`
${evaluationCriteria}
\`\`\`

## Evaluation JSON format
{
  "issues": [
    {
      "substring": "missing disclaimer text",
      "explanation": "The output is missing the required safety disclaimer"
    },
    {
      "substring": "incorrect value",
      "explanation": "The calculated value is incorrect"
    }
  ]
}
If no issues are found, return {"issues": []}`;

    try {
        const judgeResponse = await evaluationModelRunner.client.complete(
            judgePrompt,
            actualOutput,
            evaluationModelRunner.modelId
        );
        const parsed = JSON.parse(judgeResponse.trim());

        const parsedIssues = Array.isArray(parsed.issues) ? (parsed.issues as unknown[]) : [];
        const issues: EvaluationIssue[] = [];

        for (const item of parsedIssues) {
            if (
                typeof item === "object" &&
                item !== null &&
                typeof (item as EvaluationIssue).substring === "string" &&
                typeof (item as EvaluationIssue).explanation === "string"
            ) {
                const issue = item as EvaluationIssue;
                const trimmedSubstring = issue.substring.trim();
                const trimmedExplanation = issue.explanation.trim();

                if (trimmedSubstring.length > 0 && trimmedExplanation.length > 0) {
                    issues.push({
                        substring: trimmedSubstring,
                        explanation: trimmedExplanation,
                    });
                }
            }
        }

        return { issues };
    } catch (error) {
        // If parsing fails, return parse failure as critical issue
        return {
            issues: [
                {
                    substring: "",
                    explanation: `Failed to parse judge response JSON: ${getErrorMessage(error)}`,
                },
            ],
        };
    }
}

async function handleTestRun(
    jobId: string,
    prompt: Prompt,
    testCases: TestCase[],
    modelRunners: ModelRunner[],
    runsPerTest: number,
    evaluationModelRunner?: ModelRunner
): Promise<void> {
    try {
        await runTests(
            prompt,
            testCases,
            modelRunners,
            runsPerTest,
            jobId,
            undefined,
            evaluationModelRunner
        );
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

function getModelRunnerFromSelection(selection: ModelSelection): ModelRunner | null {
    const client = getConfiguredClients().find(
        (candidate) => candidate.name === selection.provider
    );
    if (!client) {
        return null;
    }

    return {
        client,
        modelId: selection.modelId,
        displayName: `${selection.provider} (${selection.modelId})`,
    };
}

function getEvaluationModelRunner(evaluationModel?: ModelSelection): ModelRunner {
    const selectedEvaluationModel = evaluationModel ?? DEFAULT_EVALUATION_MODEL;
    const evaluationRunner = getModelRunnerFromSelection(selectedEvaluationModel);

    if (!evaluationRunner) {
        throw new ConfigurationError(
            `Evaluation model ${selectedEvaluationModel.provider} (${selectedEvaluationModel.modelId}) is not available. Please configure the provider API key or pick another evaluation model.`
        );
    }

    return evaluationRunner;
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
    selectedModels?: ModelSelection[],
    evaluationModel?: ModelSelection
): Promise<string> {
    // Use OrFail variant - throws NotFoundError if prompt doesn't exist
    const prompt = getPromptByIdOrFail(promptId);

    const testCases = getTestCasesForPrompt(promptId);
    // Use requireEntity for explicit assertion with clear error message
    requireEntity(testCases.length > 0 ? testCases : null, `Test cases for prompt ${promptId}`);

    // Get model runners based on selection or saved settings
    const modelRunners =
        selectedModels && selectedModels.length > 0
            ? getModelRunnersFromSelections(selectedModels)
            : getSavedModelRunners();

    if (modelRunners.length === 0) {
        throw new ConfigurationError(
            "No LLM models selected. Please select at least one model to run tests."
        );
    }

    const evaluationMode = prompt.evaluationMode || "schema";
    const evaluationModelRunner =
        evaluationMode === "llm" ? getEvaluationModelRunner(evaluationModel) : undefined;

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

    handleTestRun(jobId, prompt, testCases, modelRunners, runsPerTest, evaluationModelRunner);

    return jobId;
}

export async function runTests(
    prompt: Prompt | string,
    testCases: TestCase[],
    modelRunners: ModelRunner[],
    runsPerTest: number = DEFAULT_RUNS_PER_TEST,
    jobId?: string,
    expectedSchema?: string,
    evaluationModelRunner?: ModelRunner
): Promise<{ score: number; results: LLMTestResult[] }> {
    // Extract prompt content and ID
    const promptContent = typeof prompt === "string" ? prompt : prompt.content;
    const promptId = typeof prompt === "string" ? undefined : prompt.id;
    const promptObj = typeof prompt === "object" ? prompt : null;

    // Get evaluation mode and criteria if prompt is an object
    const evaluationMode = promptObj?.evaluationMode || "schema";
    const evaluationCriteria = promptObj?.evaluationCriteria || null;

    // If expectedSchema not passed explicitly, try to get from prompt object
    const schemaString =
        expectedSchema ?? (typeof prompt === "object" ? prompt.expectedSchema : undefined);

    // Build the system prompt with schema hint if present
    let systemPrompt = promptContent;
    if (schemaString) {
        try {
            const parsedSchema = JSON.parse(schemaString);
            // The schema can either be:
            // 1. A full ResponseSchema object with {name, strict, schema} - extract the inner schema
            // 2. A raw JSON Schema - use as-is
            const schema =
                parsedSchema.schema && typeof parsedSchema.schema === "object"
                    ? parsedSchema.schema
                    : parsedSchema;

            // Append schema hint to the system prompt
            systemPrompt = `${promptContent}\n\n## Response Schema:\n${JSON.stringify(schema)}`;
        } catch {
            // If parsing fails, ignore the schema
            console.warn("Failed to parse expectedSchema, ignoring structured output");
        }
    }

    // Initialize progress tracking if jobId is provided
    if (jobId) {
        const progress = activeJobs.get(jobId);
        if (progress) {
            progress.status = "running";
        }
        updateTestJob(jobId, { status: "running" });
    }

    const llmResults: LLMTestResult[] = [];
    let completedTests = 0;
    const totalTests = testCases.length * modelRunners.length * runsPerTest;

    const llmPromises = modelRunners.map(async (runner) => {
        const testCaseResults: TestCaseResult[] = [];
        let llmCorrectCount = 0;
        let llmTotalRuns = 0;

        const testCasePromises = testCases.map(async (testCase) => {
            const runs: RunResult[] = [];
            let correctRuns = 0;
            let totalScore = 0;

            for (let runNumber = 1; runNumber <= runsPerTest; runNumber++) {
                try {
                    const startTime = Date.now();
                    // System prompt includes schema hint if present
                    const actualOutput = await runner.client.complete(
                        systemPrompt,
                        testCase.input,
                        runner.modelId
                    );
                    const durationMs = Date.now() - startTime;

                    let score = 0;
                    let isCorrect = false;
                    let expectedFound = 0;
                    let expectedTotal = 0;
                    let unexpectedFound = 0;
                    let issues: EvaluationIssue[] | undefined = undefined;

                    if (evaluationMode === "llm" && evaluationCriteria) {
                        // LLM evaluation mode: use judge model
                        if (!evaluationModelRunner) {
                            throw new ConfigurationError(
                                "Evaluation model is required when running LLM evaluation mode."
                            );
                        }

                        const evaluation = await evaluateWithLLMJudge(
                            promptContent,
                            testCase.input,
                            actualOutput,
                            evaluationCriteria,
                            evaluationModelRunner
                        );
                        issues = deduplicateIssues(evaluation.issues);
                        score = calculateScoreFromIssues(issues);
                        isCorrect = score === 1;
                        // For LLM evaluation mode, track issue counts as mismatch metrics.
                        expectedTotal = 1;
                        expectedFound = issues.length === 0 ? 1 : 0;
                        unexpectedFound = issues.length;
                    } else {
                        // Schema evaluation mode: use existing comparison logic
                        const expectedOutputType = testCase.expectedOutputType as ParseType;
                        const expectedParsed = parse(testCase.expectedOutput, expectedOutputType);
                        const actualParsed = parse(actualOutput, expectedOutputType);
                        const comparison = compare(
                            expectedParsed,
                            actualParsed,
                            expectedOutputType
                        );

                        score = comparison.score;
                        isCorrect = comparison.score === 1;
                        expectedFound = comparison.expectedFound;
                        expectedTotal = comparison.expectedTotal;
                        unexpectedFound = comparison.unexpectedFound;
                        issues = [];
                    }

                    if (isCorrect) {
                        correctRuns++;
                        llmCorrectCount++;
                    }
                    totalScore += score;
                    llmTotalRuns++;

                    runs.push({
                        runNumber,
                        actualOutput,
                        isCorrect,
                        score,
                        expectedFound,
                        expectedTotal,
                        unexpectedFound,
                        issues,
                        durationMs,
                    });

                    // Persist to database if jobId is provided
                    if (jobId) {
                        createTestResult(
                            jobId,
                            testCase.id,
                            runner.displayName,
                            runNumber,
                            actualOutput,
                            isCorrect,
                            score,
                            expectedFound,
                            expectedTotal,
                            unexpectedFound,
                            issues,
                            durationMs
                        );
                    }
                } catch (error) {
                    llmTotalRuns++;
                    const errorMessage = getErrorMessage(error);
                    const runIssues: EvaluationIssue[] = [
                        { substring: "", explanation: "Test run failed before evaluation" },
                    ];
                    runs.push({
                        runNumber,
                        actualOutput: null,
                        isCorrect: false,
                        score: 0,
                        expectedFound: 0,
                        expectedTotal: 0,
                        unexpectedFound: 0,
                        issues: runIssues,
                        error: errorMessage,
                    });

                    // Persist to database if jobId is provided
                    if (jobId) {
                        createTestResult(
                            jobId,
                            testCase.id,
                            runner.displayName,
                            runNumber,
                            null,
                            false,
                            0,
                            0,
                            0,
                            0,
                            runIssues
                        );
                    }
                }

                // Update progress if jobId is provided
                if (jobId) {
                    completedTests++;
                    const progress = activeJobs.get(jobId);
                    if (progress) {
                        progress.completedTests = completedTests;
                        progress.progress = Math.round((completedTests / totalTests) * 100);
                    }
                    updateTestJob(jobId, { completedTests: completedTests });
                }
            }

            const averageScore = runs.length > 0 ? totalScore / runs.length : 0;

            return {
                testCaseId: testCase.id,
                input: testCase.input,
                expectedOutput: testCase.expectedOutput,
                runs,
                correctRuns,
                averageScore,
            } as TestCaseResult;
        });

        const results = await Promise.all(testCasePromises);
        testCaseResults.push(...results);

        // Calculate duration stats from all runs
        const allDurations = testCaseResults.flatMap((tc) =>
            tc.runs.map((r) => r.durationMs).filter((d): d is number => d !== undefined)
        );
        const durationStats =
            allDurations.length > 0
                ? {
                      minMs: Math.min(...allDurations),
                      maxMs: Math.max(...allDurations),
                      avgMs: Math.round(
                          allDurations.reduce((a, b) => a + b, 0) / allDurations.length
                      ),
                  }
                : undefined;

        // Calculate average score across test cases (not all runs)
        // This gives equal weight to each test case regardless of runs per test
        const totalTestCaseScore = testCaseResults.reduce((sum, tc) => sum + tc.averageScore, 0);
        const averageScore =
            testCaseResults.length > 0 ? totalTestCaseScore / testCaseResults.length : 0;

        return {
            llmName: runner.displayName,
            correctCount: llmCorrectCount,
            totalRuns: llmTotalRuns,
            score: averageScore,
            testCaseResults,
            durationStats,
        } as LLMTestResult;
    });

    const results = await Promise.all(llmPromises);
    llmResults.push(...results);

    // Calculate overall score as average of all LLM scores
    const totalScore = llmResults.reduce((sum, r) => sum + r.score, 0);
    const score = llmResults.length > 0 ? totalScore / llmResults.length : 0;

    // Update job status and results if jobId is provided
    if (jobId) {
        const testResults: TestResults = {
            promptId: promptId ?? 0,
            promptContent: promptContent,
            totalTestCases: testCases.length,
            evaluationModel:
                evaluationMode === "llm" && evaluationCriteria && evaluationModelRunner
                    ? {
                          provider: evaluationModelRunner.client.name,
                          modelId: evaluationModelRunner.modelId,
                      }
                    : undefined,
            llmResults,
            overallScore: score,
        };

        const progress = activeJobs.get(jobId);
        if (progress) {
            progress.status = "completed";
            progress.results = testResults;
        }
        updateTestJob(jobId, {
            status: "completed",
            results: JSON.stringify(testResults),
        });
    }

    return { score, results: llmResults };
}

export function getTestResultSummary(results: LLMTestResult[]) {
    const summary: Array<{
        input: string;
        expectedOutput: string;
        actualOutput: string | null;
        isCorrect: boolean;
        score: number;
        expectedFound: number;
        expectedTotal: number;
        unexpectedFound: number;
    }> = [];

    const testCaseMap = new Map<
        number,
        {
            input: string;
            expectedOutput: string;
            outputs: Array<{
                output: string | null;
                isCorrect: boolean;
                score: number;
                expectedFound: number;
                expectedTotal: number;
                unexpectedFound: number;
            }>;
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
                    score: run.score,
                    expectedFound: run.expectedFound,
                    expectedTotal: run.expectedTotal,
                    unexpectedFound: run.unexpectedFound,
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
                score: representative.score,
                expectedFound: representative.expectedFound,
                expectedTotal: representative.expectedTotal,
                unexpectedFound: representative.unexpectedFound,
            });
        } else if (anyCorrect) {
            const correct = tc.outputs.find((o) => o.isCorrect)!;
            summary.push({
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                actualOutput: correct.output,
                isCorrect: true,
                score: correct.score,
                expectedFound: correct.expectedFound,
                expectedTotal: correct.expectedTotal,
                unexpectedFound: correct.unexpectedFound,
            });
        }
    }

    return summary;
}

/**
 * Converts a database TestResult to a RunResult.
 * Handles conversion of isCorrect from integer (0/1) to boolean.
 */
export function dbTestResultToRunResult(dbResult: DbTestResult): RunResult {
    let issues: EvaluationIssue[] | undefined = undefined;

    if (dbResult.issues) {
        try {
            const parsedIssues = JSON.parse(dbResult.issues);
            if (Array.isArray(parsedIssues)) {
                issues = parsedIssues.filter(
                    (issue): issue is EvaluationIssue =>
                        typeof issue === "object" &&
                        issue !== null &&
                        typeof issue.substring === "string" &&
                        typeof issue.explanation === "string"
                );
            }
        } catch {
            issues = [{ substring: "", explanation: "Failed to parse persisted issues" }];
        }
    }

    return {
        runNumber: dbResult.runNumber,
        actualOutput: dbResult.actualOutput,
        isCorrect: dbResult.isCorrect === 1,
        score: dbResult.score,
        expectedFound: dbResult.expectedFound,
        expectedTotal: dbResult.expectedTotal,
        unexpectedFound: dbResult.unexpectedFound,
        issues,
        error: dbResult.error ?? undefined,
        durationMs: dbResult.durationMs ?? undefined,
    };
}

/**
 * Converts a RunResult to a database TestResult format (for creating new records).
 * Note: This returns a partial object - you still need to provide jobId, testCaseId, and llmProvider.
 */
export function runResultToDbTestResult(
    runResult: RunResult,
    jobId: string,
    testCaseId: number,
    llmProvider: string
): Omit<DbTestResult, "id" | "createdAt"> {
    return {
        jobId,
        testCaseId,
        llmProvider,
        runNumber: runResult.runNumber,
        actualOutput: runResult.actualOutput,
        isCorrect: runResult.isCorrect ? 1 : 0,
        score: runResult.score,
        expectedFound: runResult.expectedFound,
        expectedTotal: runResult.expectedTotal,
        unexpectedFound: runResult.unexpectedFound,
        issues: runResult.issues ? JSON.stringify(runResult.issues) : null,
        error: runResult.error ?? null,
        durationMs: runResult.durationMs ?? null,
    };
}
