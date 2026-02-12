import type { EvaluationMode } from "../../shared/types";
import type { LLMClient, ModelSelection } from "../llm-clients";
import { compare } from "../utils/compare";
import { parse, ParseType } from "../utils/parse";
import { ConfigurationError, getErrorMessage } from "../errors";

/** Minimal prompt shape for runTests (no DB-only fields). */
export interface MinimalPrompt {
    content: string;
    expectedSchema?: string | null;
    evaluationMode?: EvaluationMode;
    evaluationCriteria?: string | null;
    id?: number;
}

/** Minimal test case shape for runTests (id required for result grouping). */
export interface MinimalTestCase {
    id: number;
    input: string;
    expectedOutput: string;
    expectedOutputType: string;
}

// Represents a model to run tests against
export interface ModelRunner {
    client: LLMClient;
    modelId: string;
    displayName: string; // e.g., "OpenAI (gpt-4o)"
}

const DEFAULT_RUNS_PER_TEST = 1;

type JsonSchemaObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonSchemaObject {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Validates that the value is a JSON object (valid JSON). Does not require JSON Schema-specific fields like $schema. */
function validate(schemaCandidate: unknown): JsonSchemaObject {
    if (!isJsonObject(schemaCandidate)) {
        throw new Error("Schema must be a JSON object");
    }
    return schemaCandidate;
}

function resolveComparisonParseType(
    declaredExpectedOutputType: string,
    expectedOutput: string
): ParseType {
    if (declaredExpectedOutputType === ParseType.ARRAY) {
        return ParseType.ARRAY;
    }
    if (declaredExpectedOutputType === ParseType.OBJECT) {
        return ParseType.OBJECT;
    }
    if (declaredExpectedOutputType === ParseType.STRING) {
        const trimmedExpectedOutput = expectedOutput.trim();
        try {
            const parsedExpectedOutput = JSON.parse(trimmedExpectedOutput);
            if (Array.isArray(parsedExpectedOutput)) {
                return ParseType.ARRAY;
            }
            if (parsedExpectedOutput !== null && typeof parsedExpectedOutput === "object") {
                return ParseType.OBJECT;
            }
        } catch {
            return ParseType.STRING;
        }
        return ParseType.STRING;
    }

    const trimmedExpectedOutput = expectedOutput.trim();
    try {
        const parsedExpectedOutput = JSON.parse(trimmedExpectedOutput);
        if (Array.isArray(parsedExpectedOutput)) {
            return ParseType.ARRAY;
        }
        if (parsedExpectedOutput !== null && typeof parsedExpectedOutput === "object") {
            return ParseType.OBJECT;
        }
    } catch {
        return ParseType.STRING;
    }
    return ParseType.STRING;
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

/**
 * Computes the deduction for a single issue based on the substring length.
 * For better readability, deduction rules are written using if/else.
 *
 * - If the trimmed substring is short (<= 4), deduction is maximal (1.2.. down to ~0.2).
 * - For longer substrings, the deduction bottoms at 0.2.
 */
function computeIssueDeduction(issue: EvaluationIssue): number {
    const substringLength = issue.substring.trim().length;

    let deduction: number;

    if (substringLength === 0) {
        deduction = 0;
    } else if (substringLength < 4) {
        // For very short substrings, deduction is highest.
        deduction = -0.2667 * substringLength + 1.2667;
    } else {
        // For typical or long substrings, use the minimum deduction.
        deduction = -0.2667 * substringLength + 1.2667;
        if (deduction < 0.2) {
            deduction = 0.2;
        }
    }

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
    const evaluationIssuesJsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        required: ["issues"],
        properties: {
            issues: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["substring", "explanation"],
                    properties: {
                        substring: { type: "string" },
                        explanation: { type: "string" },
                    },
                },
            },
        },
    };

    const judgePrompt = `You are evaluating an extraction result and must identify issues only.
Return only a valid json object.

## Your task
${evaluationCriteria}

## Initial task
${promptContent}

## Initial input
${testCaseInput}

## Required json schema
${JSON.stringify(evaluationIssuesJsonSchema)}

## Evaluation json format
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
If no issues are found, return {"issues": []}.
Do not include markdown fences. Output only json.`;

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

export async function runTests(
    prompt: MinimalPrompt | string,
    testCases: MinimalTestCase[],
    modelRunners: ModelRunner[],
    runsPerTest: number = DEFAULT_RUNS_PER_TEST,
    expectedSchema?: string,
    evaluationModelRunner?: ModelRunner
): Promise<{ score: number; results: LLMTestResult[] }> {
    const promptContent = typeof prompt === "string" ? prompt : prompt.content;
    const promptObj = typeof prompt === "object" && prompt !== null ? prompt : null;

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
            const normalizedSchema = validate(schema);

            // Append schema hint to the system prompt
            systemPrompt = `${promptContent}\n\n## Response Schema:\n${JSON.stringify(normalizedSchema)}`;
        } catch {
            // If parsing fails, ignore the schema
            console.warn("Failed to parse expectedSchema, ignoring structured output");
        }
    }

    const llmResults: LLMTestResult[] = [];

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
                        const expectedOutputType = resolveComparisonParseType(
                            testCase.expectedOutputType,
                            testCase.expectedOutput
                        );
                        const expectedParsed = parse(testCase.expectedOutput, expectedOutputType);
                        let actualParsed;
                        try {
                            actualParsed = parse(actualOutput, expectedOutputType);
                        } catch {
                            // Model outputs that do not match the expected JSON shape are treated as
                            // incorrect outputs (score 0), not runtime failures.
                            actualParsed = undefined;
                        }
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
