import { test, expect, describe, beforeEach, mock } from "bun:test";

// Set up mocks BEFORE any other imports to ensure they intercept module loading
// Mock database functions - these need to be defined before mock.module calls
const mockCreateTestJob = mock(() => {});
const mockUpdateTestJob = mock(() => {});
const mockCreateTestResult = mock(() => {});
const mockGetTestCasesForPrompt = mock(() => []);
const mockGetPromptByIdOrFail = mock(() => ({}));
const mockGetConfig = mock(() => null);

// Mock LLM clients module
const mockGetConfiguredClients = mock(() => []);

// Mock the db module to prevent database initialization errors
const mockDb = {
    select: () => ({
        from: () => ({
            where: () => ({
                get: () => null,
                all: () => [],
            }),
        }),
    }),
    insert: () => ({
        values: () => ({
            returning: () => ({
                get: () => ({}),
            }),
        }),
    }),
    update: () => ({
        set: () => ({
            where: () => ({
                run: () => {},
            }),
        }),
    }),
    delete: () => ({
        where: () => ({
            run: () => {},
        }),
    }),
};

// Initialize mock database state
let mockDbInitialized = true;

// Set up module mocks FIRST, before any imports that might load these modules
mock.module("../db", () => ({
    getDb: () => {
        if (!mockDbInitialized) {
            throw new Error("Database not initialized. Call initializeDatabase() first.");
        }
        return mockDb;
    },
    getSqlDb: () => {
        if (!mockDbInitialized) {
            throw new Error("Database not initialized. Call initializeDatabase() first.");
        }
        return {
            run: () => {},
        };
    },
    withSave: <T>(operation: () => T): T => operation(),
    initializeDatabase: () => {
        mockDbInitialized = true;
    },
    schema: {},
}));

// Mock the database module
mock.module("../database", () => ({
    createTestJob: mockCreateTestJob,
    updateTestJob: mockUpdateTestJob,
    createTestResult: mockCreateTestResult,
    getTestCasesForPrompt: mockGetTestCasesForPrompt,
    getPromptByIdOrFail: mockGetPromptByIdOrFail,
    getConfig: mockGetConfig,
}));

// Mock the llm-clients module
mock.module("../llm-clients", () => ({
    getConfiguredClients: mockGetConfiguredClients,
}));

// NOW import everything else after mocks are set up
import {
    runTests,
    startTestRun,
    getTestProgress,
    getTestResultSummary,
    type ModelRunner,
    type LLMTestResult,
} from "./test-runner";
import type { LLMClient } from "../llm-clients/llm-client";
import type { Prompt, TestCase } from "../database";
import { ParseType } from "../utils/parse";
import { ConfigurationError, NotFoundError } from "../errors";

// Create a mock LLM client
function createMockLLMClient(name: string): LLMClient {
    const mockComplete = mock(() => Promise.resolve(""));
    return {
        name,
        isConfigured: () => true,
        listModels: async () => [],
        complete: mockComplete,
    };
}

// Helper to create test cases
function createTestCase(
    id: number,
    input: string,
    expectedOutput: string,
    expectedOutputType: string = "string"
): TestCase {
    return {
        id,
        promptGroupId: 1,
        input,
        expectedOutput,
        expectedOutputType,
        createdAt: new Date().toISOString(),
    };
}

// Helper to create a prompt
function createPrompt(
    id: number,
    content: string,
    evaluationMode: "schema" | "llm" = "schema",
    evaluationCriteria: string | null = null
): Prompt {
    return {
        id,
        name: `Test Prompt ${id}`,
        content,
        expectedSchema: null,
        evaluationMode,
        evaluationCriteria,
        version: 1,
        parentVersionId: null,
        promptGroupId: id,
        createdAt: new Date().toISOString(),
    };
}

// Setup mocks before each test
beforeEach(() => {
    // Reset all mocks
    mockCreateTestJob.mockClear();
    mockUpdateTestJob.mockClear();
    mockCreateTestResult.mockClear();
    mockGetTestCasesForPrompt.mockClear();
    mockGetPromptByIdOrFail.mockClear();
    mockGetConfig.mockClear();
    mockGetConfiguredClients.mockClear();
});

describe("test-runner", () => {
    describe("runTests", () => {
        test("should run tests successfully with correct output", async () => {
            const mockClient = createMockLLMClient("test-client");
            mockClient.complete = mock(() => Promise.resolve("hello"));

            const prompt = createPrompt(1, "Test prompt");
            const testCases = [createTestCase(1, "input1", "hello", ParseType.STRING)];
            const modelRunners: ModelRunner[] = [
                {
                    client: mockClient,
                    modelId: "test-model",
                    displayName: "test-client (test-model)",
                },
            ];

            const result = await runTests(prompt, testCases, modelRunners, 1);

            expect(result.score).toBe(1); // Score is 0-1, not 0-100
            expect(result.results).toHaveLength(1);
            expect(result.results[0].llmName).toBe("test-client (test-model)");
            expect(result.results[0].correctCount).toBe(1);
            expect(result.results[0].totalRuns).toBe(1);
            expect(result.results[0].score).toBe(1); // Score is 0-1, not 0-100
            expect(result.results[0].testCaseResults).toHaveLength(1);
            expect(result.results[0].testCaseResults[0].runs[0].isCorrect).toBe(true);
            expect(result.results[0].testCaseResults[0].runs[0].score).toBe(1);
        });

        test("should handle incorrect output", async () => {
            const mockClient = createMockLLMClient("test-client");
            mockClient.complete = mock(() => Promise.resolve("wrong output"));

            const prompt = createPrompt(1, "Test prompt");
            const testCases = [createTestCase(1, "input1", "hello", ParseType.STRING)];
            const modelRunners: ModelRunner[] = [
                {
                    client: mockClient,
                    modelId: "test-model",
                    displayName: "test-client (test-model)",
                },
            ];

            const result = await runTests(prompt, testCases, modelRunners, 1);

            expect(result.score).toBe(0);
            expect(result.results[0].correctCount).toBe(0);
            expect(result.results[0].score).toBe(0);
            expect(result.results[0].testCaseResults[0].runs[0].isCorrect).toBe(false);
            expect(result.results[0].testCaseResults[0].runs[0].score).toBe(0);
        });

        test("should handle LLM errors gracefully", async () => {
            const mockClient = createMockLLMClient("test-client");
            mockClient.complete = mock(() => Promise.reject(new Error("LLM API error")));

            const prompt = createPrompt(1, "Test prompt");
            const testCases = [createTestCase(1, "input1", "hello", ParseType.STRING)];
            const modelRunners: ModelRunner[] = [
                {
                    client: mockClient,
                    modelId: "test-model",
                    displayName: "test-client (test-model)",
                },
            ];

            const result = await runTests(prompt, testCases, modelRunners, 1);

            expect(result.results[0].correctCount).toBe(0);
            expect(result.results[0].totalRuns).toBe(1);
            expect(result.results[0].testCaseResults[0].runs[0].actualOutput).toBeNull();
            expect(result.results[0].testCaseResults[0].runs[0].error).toBe("LLM API error");
            expect(result.results[0].testCaseResults[0].runs[0].isCorrect).toBe(false);
        });

        test("should run multiple test cases", async () => {
            const mockClient = createMockLLMClient("test-client");
            let callCount = 0;
            mockClient.complete = mock(() => {
                callCount++;
                // Return different outputs for different test cases
                if (callCount === 1) return Promise.resolve("hello");
                if (callCount === 2) return Promise.resolve("world");
                return Promise.resolve("test");
            });

            const prompt = createPrompt(1, "Test prompt");
            const testCases = [
                createTestCase(1, "input1", "hello", ParseType.STRING),
                createTestCase(2, "input2", "world", ParseType.STRING),
                createTestCase(3, "input3", "test", ParseType.STRING),
            ];
            const modelRunners: ModelRunner[] = [
                {
                    client: mockClient,
                    modelId: "test-model",
                    displayName: "test-client (test-model)",
                },
            ];

            const result = await runTests(prompt, testCases, modelRunners, 1);

            expect(result.results[0].testCaseResults).toHaveLength(3);
            expect(result.results[0].correctCount).toBe(3);
            expect(result.results[0].totalRuns).toBe(3);
            expect(mockClient.complete).toHaveBeenCalledTimes(3);
        });

        test("should run multiple runs per test case", async () => {
            const mockClient = createMockLLMClient("test-client");
            mockClient.complete = mock(() => Promise.resolve("hello"));

            const prompt = createPrompt(1, "Test prompt");
            const testCases = [createTestCase(1, "input1", "hello", ParseType.STRING)];
            const modelRunners: ModelRunner[] = [
                {
                    client: mockClient,
                    modelId: "test-model",
                    displayName: "test-client (test-model)",
                },
            ];

            const result = await runTests(prompt, testCases, modelRunners, 3);

            expect(result.results[0].testCaseResults[0].runs).toHaveLength(3);
            expect(result.results[0].correctCount).toBe(3);
            expect(result.results[0].totalRuns).toBe(3);
            expect(mockClient.complete).toHaveBeenCalledTimes(3);
        });

        test("should handle multiple model runners", async () => {
            const mockClient1 = createMockLLMClient("client1");
            mockClient1.complete = mock(() => Promise.resolve("hello"));

            const mockClient2 = createMockLLMClient("client2");
            mockClient2.complete = mock(() => Promise.resolve("hello"));

            const prompt = createPrompt(1, "Test prompt");
            const testCases = [createTestCase(1, "input1", "hello", ParseType.STRING)];
            const modelRunners: ModelRunner[] = [
                {
                    client: mockClient1,
                    modelId: "model1",
                    displayName: "client1 (model1)",
                },
                {
                    client: mockClient2,
                    modelId: "model2",
                    displayName: "client2 (model2)",
                },
            ];

            const result = await runTests(prompt, testCases, modelRunners, 1);

            expect(result.results).toHaveLength(2);
            expect(result.results[0].llmName).toBe("client1 (model1)");
            expect(result.results[1].llmName).toBe("client2 (model2)");
            expect(result.results[0].correctCount).toBe(1);
            expect(result.results[1].correctCount).toBe(1);
        });

        test("should calculate average score correctly for partial matches", async () => {
            const mockClient = createMockLLMClient("test-client");
            let callCount = 0;
            mockClient.complete = mock(() => {
                callCount++;
                // First call returns correct, second returns incorrect
                if (callCount === 1) return Promise.resolve("hello");
                return Promise.resolve("wrong");
            });

            const prompt = createPrompt(1, "Test prompt");
            const testCases = [createTestCase(1, "input1", "hello", ParseType.STRING)];
            const modelRunners: ModelRunner[] = [
                {
                    client: mockClient,
                    modelId: "test-model",
                    displayName: "test-client (test-model)",
                },
            ];

            const result = await runTests(prompt, testCases, modelRunners, 2);

            expect(result.results[0].correctCount).toBe(1);
            expect(result.results[0].totalRuns).toBe(2);
            expect(result.results[0].score).toBe(0.5); // Average of 1 and 0 = 0.5
            expect(result.results[0].testCaseResults[0].averageScore).toBe(0.5); // Average of 1 and 0
        });

        test("should handle ARRAY parse type", async () => {
            const mockClient = createMockLLMClient("test-client");
            mockClient.complete = mock(() => Promise.resolve('["apple", "banana"]'));

            const prompt = createPrompt(1, "Test prompt");
            const testCases = [createTestCase(1, "input1", '["apple", "banana"]', ParseType.ARRAY)];
            const modelRunners: ModelRunner[] = [
                {
                    client: mockClient,
                    modelId: "test-model",
                    displayName: "test-client (test-model)",
                },
            ];

            const result = await runTests(prompt, testCases, modelRunners, 1);

            expect(result.results[0].correctCount).toBe(1);
            expect(result.results[0].testCaseResults[0].runs[0].isCorrect).toBe(true);
        });

        test("should handle OBJECT parse type", async () => {
            const mockClient = createMockLLMClient("test-client");
            mockClient.complete = mock(() => Promise.resolve('{"key": "value"}'));

            const prompt = createPrompt(1, "Test prompt");
            const testCases = [createTestCase(1, "input1", '{"key": "value"}', ParseType.OBJECT)];
            const modelRunners: ModelRunner[] = [
                {
                    client: mockClient,
                    modelId: "test-model",
                    displayName: "test-client (test-model)",
                },
            ];

            const result = await runTests(prompt, testCases, modelRunners, 1);

            expect(result.results[0].correctCount).toBe(1);
            expect(result.results[0].testCaseResults[0].runs[0].isCorrect).toBe(true);
        });

        test("should calculate duration stats", async () => {
            const mockClient = createMockLLMClient("test-client");
            mockClient.complete = mock(async () => {
                // Simulate some delay
                await new Promise((resolve) => setTimeout(resolve, 10));
                return "hello";
            });

            const prompt = createPrompt(1, "Test prompt");
            const testCases = [createTestCase(1, "input1", "hello", ParseType.STRING)];
            const modelRunners: ModelRunner[] = [
                {
                    client: mockClient,
                    modelId: "test-model",
                    displayName: "test-client (test-model)",
                },
            ];

            const result = await runTests(prompt, testCases, modelRunners, 3);

            expect(result.results[0].durationStats).toBeDefined();
            expect(result.results[0].durationStats!.minMs).toBeGreaterThan(0);
            expect(result.results[0].durationStats!.maxMs).toBeGreaterThan(0);
            expect(result.results[0].durationStats!.avgMs).toBeGreaterThan(0);
        });

        test("should handle partial array matches", async () => {
            const mockClient = createMockLLMClient("test-client");
            mockClient.complete = mock(
                () => Promise.resolve('["apple"]') // Only one item, expected two
            );

            const prompt = createPrompt(1, "Test prompt");
            const testCases = [createTestCase(1, "input1", '["apple", "banana"]', ParseType.ARRAY)];
            const modelRunners: ModelRunner[] = [
                {
                    client: mockClient,
                    modelId: "test-model",
                    displayName: "test-client (test-model)",
                },
            ];

            const result = await runTests(prompt, testCases, modelRunners, 1);

            expect(result.results[0].correctCount).toBe(0);
            expect(result.results[0].testCaseResults[0].runs[0].score).toBeCloseTo(0.5, 1); // 1/2 = 0.5
            expect(result.results[0].testCaseResults[0].runs[0].expectedFound).toBe(1);
            expect(result.results[0].testCaseResults[0].runs[0].expectedTotal).toBe(2);
        });

        test("should handle partial object matches", async () => {
            const mockClient = createMockLLMClient("test-client");
            mockClient.complete = mock(
                () => Promise.resolve('{"key1": "value1"}') // Missing key2
            );

            const prompt = createPrompt(1, "Test prompt");
            const testCases = [
                createTestCase(
                    1,
                    "input1",
                    '{"key1": "value1", "key2": "value2"}',
                    ParseType.OBJECT
                ),
            ];
            const modelRunners: ModelRunner[] = [
                {
                    client: mockClient,
                    modelId: "test-model",
                    displayName: "test-client (test-model)",
                },
            ];

            const result = await runTests(prompt, testCases, modelRunners, 1);

            expect(result.results[0].correctCount).toBe(0);
            expect(result.results[0].testCaseResults[0].runs[0].score).toBeCloseTo(0.5, 1); // 1/2 = 0.5
            expect(result.results[0].testCaseResults[0].runs[0].expectedFound).toBe(1);
            expect(result.results[0].testCaseResults[0].runs[0].expectedTotal).toBe(2);
        });

        test("should accept string prompt instead of Prompt object", async () => {
            const mockClient = createMockLLMClient("test-client");
            mockClient.complete = mock(() => Promise.resolve("hello"));

            const testCases = [createTestCase(1, "input1", "hello", ParseType.STRING)];
            const modelRunners: ModelRunner[] = [
                {
                    client: mockClient,
                    modelId: "test-model",
                    displayName: "test-client (test-model)",
                },
            ];

            const result = await runTests("Test prompt string", testCases, modelRunners, 1);

            expect(result.score).toBe(1); // Score is 0-1, not 0-100
            expect(mockClient.complete).toHaveBeenCalledWith(
                "Test prompt string",
                "input1",
                "test-model"
            );
        });

        test("should complete successfully when jobId is provided", async () => {
            const mockClient = createMockLLMClient("test-client");
            mockClient.complete = mock(() => Promise.resolve("hello"));

            const prompt = createPrompt(1, "Test prompt");
            const testCases = [createTestCase(1, "input1", "hello", ParseType.STRING)];
            const modelRunners: ModelRunner[] = [
                {
                    client: mockClient,
                    modelId: "test-model",
                    displayName: "test-client (test-model)",
                },
            ];

            const jobId = "test-job-id";

            // Verify runTests completes successfully with jobId
            // Note: Full progress tracking requires startTestRun which sets up activeJobs
            const result = await runTests(prompt, testCases, modelRunners, 1, jobId);

            expect(result.score).toBe(1);
            expect(result.results).toHaveLength(1);
            expect(mockCreateTestResult).toHaveBeenCalled();
            expect(mockUpdateTestJob).toHaveBeenCalled();
        });

        test("should score LLM evaluation with deterministic linear equation from issues", async () => {
            const generationClient = createMockLLMClient("generator");
            const judgeClient = createMockLLMClient("judge");

            generationClient.complete = mock(() => Promise.resolve("candidate output"));
            judgeClient.complete = mock(() =>
                Promise.resolve(
                    JSON.stringify({
                        issues: [
                            {
                                substring: "wrong safety value",
                                explanation: "Safety requirement violated",
                            },
                            {
                                substring: "missing criteria",
                                explanation: "Missing acceptance criteria",
                            },
                            {
                                substring: "ambiguous wording",
                                explanation: "Minor wording ambiguity",
                            },
                        ],
                        reason: "Mainly safety and completeness issues with minor phrasing noise.",
                    })
                )
            );

            const prompt = createPrompt(1, "Test prompt", "llm", "Must be safe and complete.");
            const testCases = [createTestCase(1, "input1", "[]", ParseType.ARRAY)];
            const modelRunners: ModelRunner[] = [
                {
                    client: generationClient,
                    modelId: "gen-model",
                    displayName: "generator (gen-model)",
                },
            ];

            const result = await runTests(
                prompt,
                testCases,
                modelRunners,
                1,
                undefined,
                undefined,
                {
                    client: judgeClient,
                    modelId: "judge-model",
                    displayName: "judge (judge-model)",
                }
            );

            // 3 unique issues (no duplicates):
            // All have character lengths >= 12, so each deduction floors at 0.2:
            // - "wrong safety value" (19 chars): max(0.2, -0.2667*19+1.2667) = max(0.2, -3.8006) = 0.2
            // - "missing criteria" (15 chars): max(0.2, -0.2667*15+1.2667) = max(0.2, -2.7338) = 0.2
            // - "ambiguous wording" (18 chars): max(0.2, -0.2667*18+1.2667) = max(0.2, -3.5339) = 0.2
            // Total deduction = 0.2 + 0.2 + 0.2 = 0.6
            // Score = 1 - 0.6 = 0.4 (rounded to 6 decimals: 0.4)
            expect(result.results[0].testCaseResults[0].runs[0].score).toBeCloseTo(0.4, 6);
            expect(result.results[0].testCaseResults[0].runs[0].issues).toHaveLength(3);
            expect(result.results[0].testCaseResults[0].runs[0].unexpectedFound).toBe(3);
        });

        test("should score 0.8 for single issue with 12-char substring", async () => {
            const generationClient = createMockLLMClient("generator");
            const judgeClient = createMockLLMClient("judge");

            generationClient.complete = mock(() => Promise.resolve("candidate output"));
            judgeClient.complete = mock(() =>
                Promise.resolve(
                    JSON.stringify({
                        issues: [
                            {
                                substring: "twelve chars!!", // Exactly 12 characters
                                explanation: "Minor issue",
                            },
                        ],
                        reason: "Minor issue found.",
                    })
                )
            );

            const prompt = createPrompt(1, "Test prompt", "llm", "Must be safe and complete.");
            const testCases = [createTestCase(1, "input1", "[]", ParseType.ARRAY)];
            const modelRunners: ModelRunner[] = [
                {
                    client: generationClient,
                    modelId: "gen-model",
                    displayName: "generator (gen-model)",
                },
            ];

            const result = await runTests(
                prompt,
                testCases,
                modelRunners,
                1,
                undefined,
                undefined,
                {
                    client: judgeClient,
                    modelId: "judge-model",
                    displayName: "judge (judge-model)",
                }
            );

            // 1 issue with 12 characters: max(0.2, -0.2667*12+1.2667) = max(0.2, -1.9337) = 0.2
            // Score = 1 - 0.2 = 0.8
            expect(result.results[0].testCaseResults[0].runs[0].score).toBeCloseTo(0.8, 6);
            expect(result.results[0].testCaseResults[0].runs[0].issues).toHaveLength(1);
            expect(result.results[0].testCaseResults[0].runs[0].unexpectedFound).toBe(1);
        });
    });

    describe("getTestResultSummary", () => {
        test("should generate summary for correct results", () => {
            const results: LLMTestResult[] = [
                {
                    llmName: "test-client (test-model)",
                    correctCount: 2,
                    totalRuns: 2,
                    score: 1,
                    testCaseResults: [
                        {
                            testCaseId: 1,
                            input: "input1",
                            expectedOutput: "hello",
                            runs: [
                                {
                                    runNumber: 1,
                                    actualOutput: "hello",
                                    isCorrect: true,
                                    score: 1,
                                    expectedFound: 1,
                                    expectedTotal: 1,
                                    unexpectedFound: 0,
                                },
                            ],
                            correctRuns: 1,
                            averageScore: 1,
                        },
                    ],
                },
            ];

            const summary = getTestResultSummary(results);
            expect(summary).toHaveLength(1);
            expect(summary[0].isCorrect).toBe(true);
            expect(summary[0].actualOutput).toBe("hello");
        });

        test("should generate summary for incorrect results", () => {
            const results: LLMTestResult[] = [
                {
                    llmName: "test-client (test-model)",
                    correctCount: 0,
                    totalRuns: 1,
                    score: 0,
                    testCaseResults: [
                        {
                            testCaseId: 1,
                            input: "input1",
                            expectedOutput: "hello",
                            runs: [
                                {
                                    runNumber: 1,
                                    actualOutput: "wrong",
                                    isCorrect: false,
                                    score: 0,
                                    expectedFound: 0,
                                    expectedTotal: 1,
                                    unexpectedFound: 0,
                                },
                            ],
                            correctRuns: 0,
                            averageScore: 0,
                        },
                    ],
                },
            ];

            const summary = getTestResultSummary(results);
            expect(summary).toHaveLength(1);
            expect(summary[0].isCorrect).toBe(false);
            expect(summary[0].actualOutput).toBe("wrong");
        });

        test("should prioritize wrong outputs in summary", () => {
            const results: LLMTestResult[] = [
                {
                    llmName: "test-client (test-model)",
                    correctCount: 1,
                    totalRuns: 2,
                    score: 0.5,
                    testCaseResults: [
                        {
                            testCaseId: 1,
                            input: "input1",
                            expectedOutput: "hello",
                            runs: [
                                {
                                    runNumber: 1,
                                    actualOutput: "hello",
                                    isCorrect: true,
                                    score: 1,
                                    expectedFound: 1,
                                    expectedTotal: 1,
                                    unexpectedFound: 0,
                                },
                                {
                                    runNumber: 2,
                                    actualOutput: "wrong",
                                    isCorrect: false,
                                    score: 0,
                                    expectedFound: 0,
                                    expectedTotal: 1,
                                    unexpectedFound: 0,
                                },
                            ],
                            correctRuns: 1,
                            averageScore: 0.5,
                        },
                    ],
                },
            ];

            const summary = getTestResultSummary(results);
            expect(summary).toHaveLength(1);
            expect(summary[0].isCorrect).toBe(false);
            expect(summary[0].actualOutput).toBe("wrong"); // Should show wrong output
        });

        test("should handle multiple test cases", () => {
            const results: LLMTestResult[] = [
                {
                    llmName: "test-client (test-model)",
                    correctCount: 1,
                    totalRuns: 2,
                    score: 0.5,
                    testCaseResults: [
                        {
                            testCaseId: 1,
                            input: "input1",
                            expectedOutput: "hello",
                            runs: [
                                {
                                    runNumber: 1,
                                    actualOutput: "hello",
                                    isCorrect: true,
                                    score: 1,
                                    expectedFound: 1,
                                    expectedTotal: 1,
                                    unexpectedFound: 0,
                                },
                            ],
                            correctRuns: 1,
                            averageScore: 1,
                        },
                        {
                            testCaseId: 2,
                            input: "input2",
                            expectedOutput: "world",
                            runs: [
                                {
                                    runNumber: 1,
                                    actualOutput: "wrong",
                                    isCorrect: false,
                                    score: 0,
                                    expectedFound: 0,
                                    expectedTotal: 1,
                                    unexpectedFound: 0,
                                },
                            ],
                            correctRuns: 0,
                            averageScore: 0,
                        },
                    ],
                },
            ];

            const summary = getTestResultSummary(results);
            expect(summary).toHaveLength(2);
            expect(summary[0].input).toBe("input1");
            expect(summary[1].input).toBe("input2");
        });
    });

    describe("startTestRun", () => {
        test("should start a test run with provided models", async () => {
            const mockClient = createMockLLMClient("test-client");
            mockClient.complete = mock(() => Promise.resolve("hello"));
            mockGetConfiguredClients.mockReturnValue([mockClient]);

            const prompt = createPrompt(1, "Test prompt");
            mockGetPromptByIdOrFail.mockReturnValue(prompt);

            const testCases = [createTestCase(1, "input1", "hello", ParseType.STRING)];
            mockGetTestCasesForPrompt.mockReturnValue(testCases);

            const selectedModels = [{ provider: "test-client", modelId: "test-model" }];

            const jobId = await startTestRun(1, 1, selectedModels);

            expect(jobId).toBeDefined();
            expect(typeof jobId).toBe("string");
            expect(mockGetPromptByIdOrFail).toHaveBeenCalledWith(1);
            expect(mockGetTestCasesForPrompt).toHaveBeenCalledWith(1);
            expect(mockCreateTestJob).toHaveBeenCalled();

            // Wait a bit for async test run to complete
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Verify the LLM was called
            expect(mockClient.complete).toHaveBeenCalled();
        });

        test("should throw error when prompt not found", async () => {
            mockGetPromptByIdOrFail.mockImplementation(() => {
                throw new NotFoundError("Prompt", 999);
            });

            await expect(startTestRun(999, 1)).rejects.toThrow(NotFoundError);
        });

        test("should throw error when no test cases exist", async () => {
            const prompt = createPrompt(1, "Test prompt");
            mockGetPromptByIdOrFail.mockReturnValue(prompt);
            mockGetTestCasesForPrompt.mockReturnValue([]);

            await expect(startTestRun(1, 1)).rejects.toThrow();
        });

        test("should throw error when no models are configured", async () => {
            const prompt = createPrompt(1, "Test prompt");
            mockGetPromptByIdOrFail.mockReturnValue(prompt);
            mockGetTestCasesForPrompt.mockReturnValue([
                createTestCase(1, "input1", "hello", ParseType.STRING),
            ]);
            mockGetConfiguredClients.mockReturnValue([]);
            mockGetConfig.mockReturnValue(null);

            await expect(startTestRun(1, 1)).rejects.toThrow(ConfigurationError);
        });
    });

    describe("getTestProgress", () => {
        test("should return null for non-existent job", () => {
            const progress = getTestProgress("non-existent-job");
            expect(progress).toBeNull();
        });
    });
});
