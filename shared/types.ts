// ============================================
// Shared Types for Relia Prompt
// ============================================
// These types are shared between the frontend and backend.
// They define the API request/response interfaces.

// ============================================
// Prompt Types
// ============================================

export interface Prompt {
    id: number;
    name: string;
    content: string;
    version: number;
    promptGroupId: number;
    expectedSchema?: string | null;
    createdAt: string;
}

export interface PromptGroup {
    id: number;
    name: string;
    version: number; // Latest version count
    promptGroupId: number;
}

export interface CreatePromptRequest {
    name: string;
    content: string;
    expectedSchema?: string;
}

export interface CreateVersionRequest {
    content: string;
    expectedSchema?: string;
}

// ============================================
// Model Types
// ============================================

export interface Model {
    id: string;
    name: string;
    provider: string;
}

export interface SelectedModel {
    provider: string;
    modelId: string;
}

// ============================================
// Config Types
// ============================================

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
}

// ============================================
// Test Case Types
// ============================================

export type ExpectedOutputType = "string" | "array" | "object";

export interface TestCase {
    id: number;
    promptGroupId: number;
    input: string;
    expectedOutput: string;
    expectedOutputType: ExpectedOutputType;
    createdAt: string;
}

export interface CreateTestCaseRequest {
    input: string;
    expected_output: string;
    expected_output_type: ExpectedOutputType;
}

export interface UpdateTestCaseRequest {
    input?: string;
    expected_output?: string;
    expected_output_type?: ExpectedOutputType;
}

// ============================================
// Test Run Types
// ============================================

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface TestJob {
    id: string;
    promptId: number;
    status: JobStatus;
    totalTests: number;
    completedTests: number;
    progress: number;
    results?: TestResults | string;
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

export interface StartTestRunRequest {
    promptId: number;
    runsPerTest: number;
    selectedModels: SelectedModel[];
}

export interface StartTestRunResponse {
    jobId: string;
}

// ============================================
// Import/Export Types
// ============================================

export interface ImportPromptsResult {
    created: number;
    skipped: number;
}

export interface ImportTestCasesResult {
    count: number;
}

export interface ExportPromptData {
    name: string;
    content: string;
    expectedSchema?: string;
}

export interface ExportTestCaseData {
    input: string;
    expected_output: string;
    expected_output_type: ExpectedOutputType;
}
