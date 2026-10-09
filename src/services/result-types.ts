export interface SuiteMetricResult {
    name: string;
    value: string | number;
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
    metrics?: SuiteMetricResult[];
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

export interface EvaluationSample {
    issues: EvaluationIssue[];
    score: number;
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
    evaluations?: EvaluationSample[]; // LLM judge samples; score is their average
    error?: string;
    durationMs?: number;
    reason?: string; // LLM evaluation reason (when using LLM evaluation mode)
}

export interface RunResult extends BaseTestResult {
    runNumber: number;
}
