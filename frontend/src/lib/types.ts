// Prompt types
export interface Prompt {
    id: number;
    name: string;
    content: string;
    version: number;
    promptGroupId: number;
    expectedSchema?: string;
    createdAt: string;
}

export interface PromptGroup {
    id: number;
    name: string;
    version: number; // Latest version count
    promptGroupId: number;
}

// Model types
export interface Model {
    id: string;
    name: string;
    provider: string;
}

export interface SelectedModel {
    provider: string;
    modelId: string;
}

// Config types
export interface LLMConfig {
    openai_api_key?: string;
    bedrock_access_key_id?: string;
    bedrock_secret_access_key?: string;
    bedrock_session_token?: string;
    bedrock_region?: string;
    deepseek_api_key?: string;
    gemini_api_key?: string;
    groq_api_key?: string;
    openrouter_api_key?: string;
    selected_models?: string;
    improvement_prompt?: string;
}

// Test case types
export interface TestCase {
    id: number;
    promptGroupId: number;
    input: string;
    expectedOutput: string;
    expectedOutputType: "string" | "array" | "object";
    createdAt: string;
}

// Test run types
export interface TestJob {
    id: string;
    promptId: number;
    status: "pending" | "running" | "completed" | "failed";
    totalTests: number;
    completedTests: number;
    progress: number;
    results?: TestResults;
    error?: string;
    createdAt: string;
}

export interface TestResults {
    overallScore: number;
    llmResults: LLMResult[];
}

export interface LLMResult {
    llmName: string;
    score: number;
    durationStats?: DurationStats;
    testCaseResults: TestCaseResult[];
}

export interface DurationStats {
    minMs: number;
    maxMs: number;
    avgMs: number;
}

export interface TestCaseResult {
    input: string;
    expectedOutput: string;
    averageScore: number;
    runs: TestRun[];
}

export interface TestRun {
    score: number;
    isCorrect: boolean;
    actualOutput?: string;
    error?: string;
    durationMs?: number;
    expectedFound?: number;
    expectedTotal?: number;
    unexpectedFound?: number;
}

// Improvement types
export interface ImprovementJob {
    id: string;
    promptId: number;
    status: "pending" | "running" | "completed" | "failed";
    currentIteration: number;
    maxIterations: number;
    originalScore?: number;
    bestScore?: number;
    bestPromptContent?: string;
    log: string[];
    error?: string;
    createdAt: string;
}

export interface ImprovementTemplate {
    template: string;
    defaultTemplate: string;
}
